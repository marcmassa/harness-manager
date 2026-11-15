"""Validate a team's declared authority policy; not an identity authenticator."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ACTIONS = {'scope', 'spec_approval', 'implementation', 'technical_review', 'merge', 'publication'}
HUMAN_ONLY = {'scope', 'spec_approval', 'merge', 'publication'}
HIGH_RISK = {'public_contract', 'permissions', 'state_migration', 'approval_model'}
TRUST = ['project_policy', 'approved_spec', 'external_data', 'unapproved_proposal']
EXAMPLE_POLICY = 'docs/team-policy/example.json'
SCENARIO_IDS = {'small-fix', 'incompatible-change', 'approved-spec-change',
                'failed-check', 'external-instruction', 'abandoned-work'}
DECISION_FIELDS = ('id', 'decision', 'responsible_role', 'expected_gate')
OBJECT_ID = re.compile(r'^[0-9a-f]{40}(?:[0-9a-f]{24})?$')
REPOSITORY = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/[A-Za-z0-9._-]{1,100}$')
LOGIN = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$')
BRANCH = re.compile(r'^(?!.*\.\.)(?!.*//)[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_policy(policy):
    require(policy.get('format_version') == 1, 'unsupported team policy format')
    roles = policy.get('roles', {})
    require(isinstance(roles, dict) and roles, 'roles must be a nonempty object')
    for name, role in roles.items():
        require(isinstance(role, dict) and role.get('kind') in ('human', 'agent'), 'invalid role: ' + name)
    authority = policy.get('authority', {})
    require(set(authority) == ACTIONS, 'authority must define all six actions')
    for action, owners in authority.items():
        require(isinstance(owners, list) and owners, 'no authority for ' + action)
        require(all(owner in roles for owner in owners), 'unknown authority role for ' + action)
        if action in HUMAN_ONLY:
            require(all(roles[owner]['kind'] == 'human' for owner in owners), action + ' requires human authority')
    require(policy.get('trust_order') == TRUST, 'source trust order must preserve project policy authority')
    require(policy.get('review_mode') in ('local', 'repository'), 'invalid review mode')
    require(policy.get('independent_review') is True, 'independent closing review is required')
    require(policy.get('default_risk') == 'full', 'ambiguous changes default to full SDD')
    limit = policy.get('max_concurrent', 1)
    require(isinstance(limit, int) and not isinstance(limit, bool) and limit >= 1,
            'max_concurrent must be a positive integer')
    historical = policy.get('historical_features', [])
    require(isinstance(historical, list) and all(isinstance(item, str) for item in historical),
            'historical_features must be an array of feature ids')
    if historical:
        require(isinstance(policy.get('adoption_revision'), str)
                and OBJECT_ID.match(policy['adoption_revision']) is not None,
                'historical_features require adoption_revision: the full id of a commit '
                'made before team_policy was activated')
    if policy['review_mode'] == 'repository':
        validate_repository_review(policy.get('repository_review'))
    return policy


def validate_repository_review(config):
    """The provider binding the trusted verifier reads from the trusted base branch."""
    require(isinstance(config, dict), 'repository review requires policy.repository_review')
    require(config.get('provider') == 'github', 'repository_review.provider must be github')
    require(isinstance(config.get('repository'), str) and REPOSITORY.match(config['repository']),
            'repository_review.repository must be owner/name')
    require(isinstance(config.get('base_branch'), str) and BRANCH.match(config['base_branch']),
            'repository_review.base_branch must name the protected default branch')
    allowed = config.get('allowed_reviewers')
    require(isinstance(allowed, list) and allowed and all(
        isinstance(item, str) and LOGIN.match(item) for item in allowed),
        'repository review requires allowed_reviewers (provider logins)')
    return config


def repository_path(root, configured, field):
    """Resolve a configured path, refusing traversal and symlink escapes."""
    require(isinstance(configured, str) and configured.strip(), field + ' must be a path')
    base = Path(root).resolve()
    resolved = (base / configured).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise ValueError(field + ' must stay inside the repository')
    return resolved


def load_active_policy(root):
    """Return the opted-in policy, or None when the project never opted in."""
    manifest_path = Path(root) / '.agents/agentic.json'
    if not manifest_path.is_file():
        return None
    configured = json.loads(manifest_path.read_text(encoding='utf-8')).get('team_policy')
    if not configured:
        return None
    resolved = repository_path(root, configured, 'team_policy')
    require(resolved != repository_path(root, EXAMPLE_POLICY, 'example policy'),
            'the example policy is not an active default; copy and customize it')
    return validate_policy(json.loads(resolved.read_text(encoding='utf-8')))


def authorize(policy, action, role):
    validate_policy(policy)
    require(role in policy['authority'].get(action, []), '{} cannot authorize {}'.format(role, action))


def validate_work(policy, work):
    validate_policy(policy)
    require(work.get('risk') in ('lightweight', 'full'), 'risk classification required')
    for field in ('scope', 'risk_rationale', 'acceptance_evidence', 'closing_reviewer'):
        require(bool(work.get(field)), 'work missing ' + field)
    role = work['closing_reviewer']
    authorize(policy, 'technical_review', role)
    require(work.get('author') != role, 'author cannot provide independent closing review')
    if work['risk'] == 'lightweight':
        require(isinstance(work.get('risk_flags'), dict), 'explicit risk flags required')
        flags = work['risk_flags']
        require(set(flags) == HIGH_RISK and all(isinstance(v, bool) for v in flags.values()), 'all risk flags must be explicit booleans')
        require(not any(flags.values()), 'risk-bearing change requires full SDD')
    else:
        require(policy['roles'][role]['kind'] == 'human', 'full SDD requires human closing review')
        approval = work.get('approval', {})
        authorize(policy, 'spec_approval', approval.get('role'))
        require(bool(approval.get('evidence_ref')), 'full SDD requires spec approval evidence')


def validate_exception(policy, exception):
    validate_policy(policy)
    for field in ('reason', 'human_authorizer', 'affected_controls', 'reapproval_decision'):
        require(bool(exception.get(field)), 'exception missing ' + field)
    authorize(policy, 'scope', exception['human_authorizer'])
    require(exception['reapproval_decision'] in ('required', 'not-required'), 'explicit reapproval decision required')
    require(isinstance(exception['affected_controls'], list), 'affected_controls must be an array')


def validate_reviewed_scenarios(policy, scenarios):
    """Structural check only; verify_scenario_acceptance binds reviews to a real record."""
    validate_policy(policy)
    require({s['id'] for s in scenarios} == SCENARIO_IDS and len(scenarios) == 6, 'six policy scenarios are required')
    for scenario in scenarios:
        for field in ('decision', 'responsible_role', 'expected_gate'):
            require(bool(scenario.get(field)), 'scenario missing ' + field)
        review = scenario.get('human_review') or {}
        authorize(policy, 'scope', review.get('role'))
        require(review.get('accepted') is True and bool(review.get('evidence_ref')), 'human scenario review is required')


def scenario_decisions_digest(scenarios):
    """Digest what was accepted: the four decision fields, in file order."""
    accepted = [{field: scenario.get(field) for field in DECISION_FIELDS} for scenario in scenarios]
    return hashlib.sha256(json.dumps(accepted, sort_keys=True).encode('utf-8')).hexdigest()


def verify_scenario_acceptance(root, policy, scenarios):
    """Require an in-repository decision record for this project and these exact decisions."""
    validate_reviewed_scenarios(policy, scenarios)
    references = {scenario['human_review']['evidence_ref'] for scenario in scenarios}
    require(len(references) == 1, 'scenario reviews must cite one decision record')
    path = repository_path(root, references.pop(), 'scenario evidence_ref')
    require(path.is_file(), 'scenario decision record does not exist: {}'.format(path.name))
    record = json.loads(path.read_text(encoding='utf-8'))
    require(isinstance(record, dict), 'scenario decision record must be an object')
    require(set(record.get('scenario_ids') or []) == SCENARIO_IDS, 'decision record omits scenarios')
    require(record.get('accepted_decisions_sha256') == scenario_decisions_digest(scenarios),
            'scenario decisions differ from the accepted record')
    features = json.loads((Path(root) / 'feature_list.json').read_text(encoding='utf-8'))
    require(record.get('feature_id') in {item.get('id') for item in features.get('features', [])},
            'scenario decision record belongs to another project')
    require('not provider-authenticated' in str(record.get('assurance', '')),
            'scenario decision record must state its assurance honestly')
    return record


def sanitize_scenarios(scenarios):
    """Consumer copies must start unreviewed; a maintainer's acceptance is not theirs."""
    return [dict(scenario, human_review=None) for scenario in scenarios]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--policy', type=Path)
    parser.add_argument('--scenarios', type=Path)
    parser.add_argument('--root', type=Path, help='also verify acceptance against its decision record')
    parser.add_argument('--sanitize-scenarios', nargs=2, type=Path, metavar=('INPUT', 'OUTPUT'))
    args = parser.parse_args()
    if args.sanitize_scenarios:
        source, output = args.sanitize_scenarios
        clean = sanitize_scenarios(json.loads(source.read_text(encoding='utf-8')))
        output.write_text(json.dumps(clean, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        return 0
    require(args.policy is not None, '--policy is required')
    policy = validate_policy(json.loads(args.policy.read_text()))
    if args.scenarios:
        scenarios = json.loads(args.scenarios.read_text())
        if args.root:
            verify_scenario_acceptance(args.root, policy, scenarios)
        else:
            validate_reviewed_scenarios(policy, scenarios)
    print('[PASS] team policy' + (' and declared human scenario reviews' if args.scenarios else ' structure'))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError) as error:
        print('[FAIL] team policy: {}'.format(error), file=sys.stderr)
        sys.exit(1)
