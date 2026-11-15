"""Record-only workflow operations: approval, scope, evidence, checks, review, recovery.

Each one applies its change to the record as it is on disk under the workflow
lock (workflow_io.update_record), so concurrent commands cannot lose updates.
"""
from pathlib import Path
import subprocess

from approval import (PENDING, REPOSITORY_UNAVAILABLE, digest_from_spec_dir,  # noqa: F401
                      task_structure_digest)
from classification import require_human_decision
from evidence import requirement_ids, validate_evidence_item
import git_state
from team_policy import authorize, load_active_policy, validate_exception, validate_repository_review
from workflow import find_feature, spec_directory, spec_state
from workflow_io import (FEATURE_LIST, UNMANAGED, load_state_text, managed, read_record_text,
                         update_record, workflow_lock, write_state_json)
from workflow_store import rollback_incomplete


def _require_in_progress(feature):
    if feature['status'] != 'in_progress':
        raise ValueError('closing evidence requires an in_progress feature')


def record_approval(root, feature_id, reviewer, role, evidence_ref, pull_request=None):
    """Store a declared human decision bound to current spec bytes. Not authentication.

    In repository mode the decision names the pull request whose provider review
    the trusted verifier will check; until then it is pending-trusted-verification.
    """
    with workflow_lock(root):
        root_path, text, data = load_state_text(root)
        if load_active_policy(root_path) is None:
            return _approve_unmanaged(root_path, text, data, feature_id, reviewer, evidence_ref,
                                      pull_request)

    def mutate(root_path, feature, policy, record):
        if record['risk'] != 'full':
            raise ValueError('lightweight work has no spec approval')
        if feature['status'] not in ('spec_ready', 'in_progress', 'blocked'):
            raise ValueError('approval requires a spec_ready, in_progress, or blocked feature')
        require_human_decision(policy, 'spec_approval', role, evidence_ref)
        if not isinstance(reviewer, str) or not reviewer.strip():
            raise ValueError('approval reviewer is required')
        spec_dir = spec_directory(root_path, feature)
        decision = {'spec_digest': digest_from_spec_dir(spec_dir),
                    'task_digest': task_structure_digest((spec_dir / 'tasks.md').read_bytes()),
                    'review_mode': policy['review_mode'], 'reviewer': reviewer, 'role': role,
                    'evidence_ref': evidence_ref, 'approved_revision': git_state.head(root_path),
                    'assurance': 'declared-local-decision'}
        if policy['review_mode'] == 'repository':
            config = validate_repository_review(policy.get('repository_review'))
            if not isinstance(pull_request, int) or isinstance(pull_request, bool) or pull_request < 1:
                raise ValueError('repository mode approval requires --pull-request: the reviewed PR')
            if reviewer.casefold() not in {item.casefold() for item in config['allowed_reviewers']}:
                raise ValueError('repository mode reviewer must be an allowed provider login')
            decision.update(pull_request=pull_request, assurance=PENDING)
        elif pull_request is not None:
            raise ValueError('--pull-request applies only to repository review mode')
        if record.get('approval'):
            record.setdefault('approval_history', []).append(record['approval'])
        record['approval'] = decision
        return {'approved': feature_id, 'spec_digest': decision['spec_digest'],
                'assurance': decision['assurance']}
    return update_record(root, feature_id, mutate)


def _approve_unmanaged(root_path, text, data, feature_id, reviewer, evidence_ref, pull_request):
    """Without a policy there are no roles: bind the declared decision to the spec bytes."""
    feature = find_feature(data, feature_id)
    if feature.get('sdd') is False:
        raise ValueError('non-sdd work has no spec approval')
    if feature.get('status') not in ('spec_ready', 'in_progress', 'blocked', 'done'):
        raise ValueError('approval requires a spec_ready, in_progress, blocked, or done feature')
    if pull_request is not None:
        raise ValueError('--pull-request applies only to repository review mode')
    for value in (reviewer, evidence_ref):
        if not isinstance(value, str) or not value.strip():
            raise ValueError('approval requires a declared reviewer and evidence reference')
    feature['spec_approval'] = dict(spec_state(spec_directory(root_path, feature)),
                                    reviewer=reviewer, evidence_ref=evidence_ref,
                                    assurance='declared-unmanaged-no-roles')
    write_state_json(root_path, FEATURE_LIST, text, data)
    return {'approved': feature_id, 'spec_digest': feature['spec_approval']['spec_digest'],
            'assurance': 'declared-unmanaged-no-roles'}


def record_scope_change(root, feature_id, reason, authorized_by, affected_controls, reapproval):
    def mutate(root_path, feature, policy, record):
        spec_dir = spec_directory(root_path, feature)
        change = {'reason': reason, 'human_authorizer': authorized_by,
                  'affected_controls': list(affected_controls), 'reapproval_decision': reapproval,
                  'task_digest': task_structure_digest((spec_dir / 'tasks.md').read_bytes())}
        validate_exception(policy, change)
        record.setdefault('scope_changes', []).append(change)
        return {'recorded_scope_change': feature_id, 'reapproval_decision': reapproval}
    return update_record(root, feature_id, mutate)


def _supersede(record, keep, revision, reason):
    current, superseded = [], []
    for existing in record['evidence']:
        (current if keep(existing) else superseded).append(existing)
    record['evidence'] = current
    if superseded:
        record.setdefault('superseded_evidence', []).extend(
            dict(item, superseded_at=revision, superseded_reason=reason) for item in superseded)
    return len(superseded)


def add_evidence(root, feature_id, item):
    """Record evidence for HEAD; entries for older revisions move to superseded_evidence."""
    def mutate(root_path, feature, policy, record):
        _require_in_progress(feature)
        if record['risk'] != 'full':
            raise ValueError('requirement evidence applies to full SDD work')
        revision = git_state.head(root_path)
        entry = dict(item, revision=revision)
        spec_dir = spec_directory(root_path, feature)
        identifiers = requirement_ids((spec_dir / 'requirements.md').read_text(encoding='utf-8'))
        validate_evidence_item(entry, identifiers, revision, root_path, policy, record['owner'])
        key = (entry['requirement_id'], entry['source'])
        count = _supersede(record, lambda old: old.get('revision') == revision and (
            old.get('requirement_id'), old.get('source')) != key, revision,
            'replaced or recorded for an older revision')
        record['evidence'].append(entry)
        return {'recorded_evidence': entry['requirement_id'], 'revision': revision,
                'superseded': count}
    return update_record(root, feature_id, mutate)


def remove_evidence(root, feature_id, requirement, source, reason):
    """Retire a wrong or renamed entry explicitly; it stays in superseded_evidence."""
    if not isinstance(reason, str) or not reason.strip():
        raise ValueError('removing evidence requires a reason')

    def mutate(root_path, feature, policy, record):
        _require_in_progress(feature)
        count = _supersede(record, lambda old: (old.get('requirement_id'), old.get('source')) !=
                           (requirement, source), git_state.head(root_path), reason)
        if not count:
            raise ValueError('no evidence entry matches {} {}'.format(requirement, source))
        return {'removed_evidence': requirement, 'source': source, 'count': count}
    return update_record(root, feature_id, mutate)


def run_checks(root, feature_id):
    """Execute check.sh itself so the stored result is observed, not declared."""
    root_path, _text, data, _policy = managed(root)
    feature = find_feature(data, feature_id)
    _require_in_progress(feature)
    if read_record_text(root_path, feature)[1] is None:
        raise ValueError('no work record for {}; run workflow-init first'.format(feature_id))
    dirty = git_state.candidate_paths_dirty(root_path)
    if dirty:
        raise ValueError('commit the candidate before checks: ' + ', '.join(sorted(dirty)[:10]))
    revision = git_state.head(root_path)
    result = subprocess.run(['./check.sh'], cwd=str(root_path), stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, universal_newlines=True)
    entry = {'id': 'check.sh', 'required': True, 'command': './check.sh', 'revision': revision,
             'result': 'passed' if result.returncode == 0 else 'failed', 'source': 'observed'}

    def mutate(root_path, feature, policy, record):
        _require_in_progress(feature)
        if git_state.head(root_path) != revision or git_state.candidate_paths_dirty(root_path):
            raise ValueError('candidate changed while checks were running; nothing recorded')
        record['checks'] = [check for check in record.get('checks') or []
                            if check.get('id') != 'check.sh'] + [entry]
        return {'check': entry['result'], 'revision': revision, 'exit_code': result.returncode}
    return update_record(root, feature_id, mutate)


def record_review(root, feature_id, reviewer, role, decision, evidence_ref, acceptance_evidence=None):
    def mutate(root_path, feature, policy, record):
        _require_in_progress(feature)
        authorize(policy, 'technical_review', role)
        if decision not in ('approved', 'changes_requested'):
            raise ValueError('review decision must be approved or changes_requested')
        if record['risk'] == 'lightweight':
            if not acceptance_evidence:
                raise ValueError('lightweight closing review requires acceptance evidence')
            record['lightweight']['acceptance_evidence'] = acceptance_evidence
        record['closing_review'] = {'reviewer': reviewer, 'role': role, 'decision': decision,
                                    'evidence_ref': evidence_ref,
                                    'revision': git_state.head(root_path),
                                    'assurance': 'declared-local-decision'}
        return {'review': decision, 'assurance': 'declared-local-decision'}
    return update_record(root, feature_id, mutate)


def _recovery(event, authorized_by, evidence_ref, assurance):
    return {'event': event, 'authorized_by': authorized_by, 'evidence_ref': evidence_ref,
            'decision': 'human-confirmed-no-automatic-rerun', 'assurance': assurance}


def recover_hook(root, feature_id, event, authorized_by, evidence_ref):
    """Record a human decision to continue; side effects are deliberately not rerun."""
    with workflow_lock(root):
        root_path, text, data = load_state_text(root)
        if load_active_policy(root_path) is None:
            return _recover_unmanaged(root_path, text, data, feature_id, event, authorized_by,
                                      evidence_ref)

    def mutate(root_path, feature, policy, record):
        require_human_decision(policy, 'scope', authorized_by, evidence_ref)
        pending = record.get('pending_hook')
        if not isinstance(pending, dict) or pending.get('event') != event:
            raise ValueError('matching failed hook event is not pending')
        record.setdefault('hook_recoveries', []).append(
            _recovery(event, authorized_by, evidence_ref, 'declared-local-decision'))
        record.pop('pending_hook')
        return {'recovered': event, 'side_effects': 'not-rerun'}
    return update_record(root, feature_id, mutate)


def _recover_unmanaged(root_path, text, data, feature_id, event, authorized_by, evidence_ref):
    """Without a policy there are no roles; the decision is recorded as declared text."""
    feature = find_feature(data, feature_id)
    pending = feature.get('pending_hook')
    if not isinstance(pending, dict) or pending.get('event') != event:
        raise ValueError('matching failed hook event is not pending')
    for value in (authorized_by, evidence_ref):
        if not isinstance(value, str) or not value.strip():
            raise ValueError('recovery requires a declared authorizer and evidence reference')
    feature.pop('pending_hook')
    feature['last_hook_recovery'] = _recovery(event, authorized_by, evidence_ref,
                                              'declared-unmanaged-no-roles')
    write_state_json(root_path, FEATURE_LIST, text, data)
    return {'recovered': event, 'side_effects': 'not-rerun', 'assurance': 'declared-unmanaged-no-roles'}


def rollback_mutation(root, authorized_by, evidence_ref):
    root_path = Path(root).resolve()
    policy = load_active_policy(root_path)
    if policy is None:
        raise ValueError(UNMANAGED)
    require_human_decision(policy, 'scope', authorized_by, evidence_ref)
    return rollback_incomplete(root_path)
