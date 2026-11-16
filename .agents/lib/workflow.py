"""Shared SDD transition validation; no function in this module mutates state."""
from pathlib import Path
import re

from approval import digest_from_spec_dir, task_structure_digest, verify_approval
from classification import require_lightweight_history, validate_classification
from evidence import (requirement_ids, validate_checks, validate_closing_review,
                      validate_evidence, validate_tasks)
import git_state
from team_policy import HIGH_RISK, load_active_policy, validate_work
from workflow_store import load_json, refuse_incomplete

STATUSES = {'pending', 'spec_ready', 'in_progress', 'done', 'blocked'}
GATE_STATUSES = {'spec_ready', 'in_progress', 'done'}
ARTIFACTS = ('requirements.md', 'design.md', 'tasks.md')
SAFE_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
SCHEMA = Path(__file__).resolve().parents[1] / 'schemas/work-record.json'
TYPES = {'string': str, 'array': list}
# Optional or nullable nested fields; a wrong type is refused instead of crashing later.
NESTED = {'approval': (dict, type(None)), 'handoff': (dict, str, type(None)),
          'lightweight': (dict,), 'checks': (list,), 'closing_review': (dict, type(None)),
          'pending_hook': (dict,), 'scope_changes': (list,), 'blocked_from': (str,),
          'blocked_reason': (str,), 'spec_dir': (str, type(None)), 'branch': (str, type(None)),
          'worktree': (str, type(None)), 'superseded_evidence': (list,)}
LIST_OF_OBJECTS = ('evidence', 'checks', 'scope_changes')
FULL_EDGES = {('pending', 'spec_ready'), ('spec_ready', 'in_progress'), ('in_progress', 'done'),
              ('pending', 'blocked'), ('spec_ready', 'blocked'), ('in_progress', 'blocked')}
LIGHT_EDGES = {('pending', 'in_progress'), ('in_progress', 'done'),
               ('pending', 'blocked'), ('in_progress', 'blocked')}


def validate_record(record):
    if not isinstance(record, dict):
        raise ValueError('work record must be an object')
    schema = load_json(SCHEMA)
    if record.get('format_version') != schema['format_version']:
        raise ValueError('unsupported work record format_version {!r}; this framework supports '
                         '{}: migrate the record before retrying'.format(
                             record.get('format_version'), schema['format_version']))
    for field, kind in schema['required'].items():
        value = record.get(field)
        if not isinstance(value, TYPES[kind]) or (kind == 'string' and not value.strip()):
            raise ValueError('work record {} must be a nonempty {}'.format(field, kind))
    for field in schema['present_nullable']:
        if field not in record:
            raise ValueError('work record must declare ' + field)
    for field, kinds in NESTED.items():
        if field in record and not isinstance(record[field], kinds):
            raise ValueError('work record {} has an invalid type'.format(field))
    for field in LIST_OF_OBJECTS:
        if not all(isinstance(item, dict) for item in record.get(field) or []):
            raise ValueError('work record {} entries must be objects'.format(field))
    if not (record['branch'] or record['worktree']):
        raise ValueError('work record requires a branch or worktree')
    if record['risk'] not in ('full', 'lightweight'):
        raise ValueError('work record risk must be full or lightweight')
    if record['status'] not in STATUSES:
        raise ValueError('work record status is invalid')
    if not git_state.OBJECT_ID.match(record['revision']):
        raise ValueError('work record revision must be a full Git object id')


def validate_feature_list(data):
    if not isinstance(data, dict) or not isinstance(data.get('features'), list) or not all(
            isinstance(item, dict) for item in data['features']):
        raise ValueError('feature_list.json must be an object with a features array of objects')
    return data


def feature_identity(feature):
    for field in ('id', 'name'):
        if not isinstance(feature.get(field), str) or not SAFE_NAME.match(feature[field]):
            raise ValueError('feature {} is not a safe identifier'.format(field))


def find_feature(feature_data, feature_id):
    validate_feature_list(feature_data)
    matches = [item for item in feature_data.get('features', []) if item.get('id') == feature_id]
    if len(matches) != 1:
        raise ValueError('feature not found or duplicated: ' + str(feature_id))
    feature_identity(matches[0])
    return matches[0]


def record_path(root, feature):
    return Path(root) / 'progress/work' / (feature['name'] + '.json')


def spec_directory(root, feature):
    """Return specs/<feature name>, the only spec a feature may be judged against."""
    root_path = Path(root).resolve()
    expected = root_path / 'specs' / feature['name']
    if expected.resolve() != expected:
        raise ValueError('spec directory must not be redirected by a symlink')
    for name in ARTIFACTS:
        if (expected / name).is_symlink() or not (expected / name).is_file():
            raise ValueError('missing spec artifact: ' + name)
    return expected


def effective_max_concurrent(feature_data, policy):
    """An explicit team policy may raise the limit; otherwise honor feature_list rules."""
    if policy and 'max_concurrent' in policy:
        return policy['max_concurrent']
    limit = feature_data.get('rules', {}).get('maxConcurrent', 1)
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        raise ValueError('rules.maxConcurrent must be a positive integer')
    return limit


def _check_concurrency(feature, feature_data, policy):
    if not isinstance(feature_data, dict):
        raise ValueError('concurrency cannot be checked without the feature list')
    others = [item.get('id') for item in feature_data.get('features', [])
              if item.get('status') == 'in_progress' and item.get('id') != feature.get('id')]
    limit = effective_max_concurrent(feature_data, policy)
    if len(others) + 1 > limit:
        raise ValueError('maxConcurrent {} exceeded; already in_progress: {}'.format(
            limit, ', '.join(others)))


def _text_required(value, message):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(message)


def _check_edge(current, target, reason, blocked_from, edges):
    if target == current:
        if target not in GATE_STATUSES:
            raise ValueError('transition must change status')
    elif current == 'done':
        if target != 'in_progress':
            raise ValueError('done work may only reopen to in_progress')
        _text_required(reason, 'reopening done requires a reason')
    elif current == 'blocked':
        if blocked_from is not None and target != blocked_from:
            raise ValueError('blocked work may only return to its previous status')
        if target not in ('pending', 'spec_ready', 'in_progress'):
            raise ValueError('illegal SDD transition: blocked -> ' + target)
    elif (current, target) not in edges:
        raise ValueError('illegal SDD transition: {} -> {}'.format(current, target))
    if target == 'blocked':
        _text_required(reason, 'blocked transition requires a reason')


def spec_state(spec_dir):
    """Digests that bind an approval to the spec bytes; tasks.md ignores completion markers."""
    return {'spec_digest': digest_from_spec_dir(spec_dir),
            'task_digest': task_structure_digest((spec_dir / 'tasks.md').read_bytes())}


def verify_spec_approval(feature, spec_dir):
    """Without a team policy: a recorded approval must still match the spec. None = not recorded."""
    approval = feature.get('spec_approval')
    if approval is None:
        return None
    if not isinstance(approval, dict):
        raise ValueError('spec_approval must be an object')
    current = spec_state(spec_dir)
    if approval.get('spec_digest') != current['spec_digest']:
        raise ValueError('{}: approved requirements/design changed; a human must re-approve '
                         '(workflow-approve)'.format(feature.get('id')))
    if approval.get('task_digest') != current['task_digest']:
        raise ValueError('{}: tasks.md changed beyond completion markers; a human must re-approve '
                         '(workflow-approve)'.format(feature.get('id')))
    return approval


def _validate_unmanaged(feature, target, current, context, root):
    """Projects without a team policy keep the structural gates, labeled as such."""
    sdd = feature.get('sdd') is not False
    origin = feature.get('blocked_from')
    if current == 'blocked' and target != 'blocked' and not isinstance(origin, str):
        # Blocked by hand, so the origin is unknown: re-enter before the gates, never past them.
        origin = None
        if target not in (('pending', 'spec_ready') if sdd else ('pending',)):
            raise ValueError('blocked work with no recorded origin may only return to pending{}'
                             .format(' or spec_ready' if sdd else ''))
    _check_edge(current, target, context.get('reason'), origin, FULL_EDGES if sdd else LIGHT_EDGES)
    recorded = False
    if target == 'in_progress':
        _check_concurrency(feature, context.get('feature_data'), None)
    if sdd and target in GATE_STATUSES:
        spec_dir = spec_directory(root, feature)
        if target != 'spec_ready':
            recorded = verify_spec_approval(feature, spec_dir) is not None
        if target == 'done':
            validate_tasks((spec_dir / 'tasks.md').read_text(encoding='utf-8'))
    return {'legacy': True, 'current': current, 'target': target,
            'assurance': 'no-team-policy-structural-gates-only',
            'spec_approval': 'unchanged-since-approval' if recorded else 'not-recorded'}


def _candidate(root, record, context):
    """Bind closure to HEAD and a matching tree, or a stored record to its own revision."""
    if context.get('recorded_state'):
        revision = git_state.require_commit(root, record['revision'], 'record revision')
        git_state.require_ancestor(root, revision, git_state.head(root), 'record revision')
        return revision
    current = git_state.head(root)
    requested = context.get('revision')
    if requested and requested != current:
        raise ValueError('requested revision is not the current candidate: ' + current)
    dirty = git_state.candidate_paths_dirty(root)
    if dirty:
        raise ValueError('working tree differs from candidate: ' + ', '.join(sorted(dirty)[:10]))
    return current


def _verify_full_approval(record, policy, root, spec_dir, context, candidate):
    tasks = (spec_dir / 'tasks.md').read_bytes()
    assurance = verify_approval(record, digest_from_spec_dir(spec_dir), policy,
                                context.get('trusted_review'), task_structure_digest(tasks),
                                candidate)
    approved = git_state.require_commit(root, record['approval'].get('approved_revision'),
                                        'approved_revision')
    git_state.require_ancestor(root, approved, candidate, 'approved_revision')
    return assurance


def _validate_full(feature, target, record, evidence, policy, context, root):
    expected_dir = 'specs/' + feature['name']
    if record['spec_dir'] != expected_dir:
        raise ValueError('work record spec_dir must be ' + expected_dir)
    if target not in GATE_STATUSES:
        return {}
    spec_dir = spec_directory(root, feature)
    result = {'spec_digest': digest_from_spec_dir(spec_dir)}
    if target == 'spec_ready':
        return result
    candidate = _candidate(root, record, context) if target == 'done' else git_state.head(root)
    git_state.require_commit(root, record['revision'], 'record revision')
    result['approval'] = _verify_full_approval(record, policy, root, spec_dir, context, candidate)
    if target == 'done':
        identifiers = requirement_ids((spec_dir / 'requirements.md').read_text(encoding='utf-8'))
        validate_tasks((spec_dir / 'tasks.md').read_text(encoding='utf-8'))
        # A stored closure is judged in its own revision: later commits may rename its tests.
        validate_evidence(identifiers, evidence, candidate, root, policy, record['owner'],
                          working_tree=not context.get('recorded_state'))
        validate_checks(record.get('checks'), candidate)
        validate_closing_review(record.get('closing_review'), record['owner'], policy, candidate)
        result['revision'] = candidate
    return result


def _lightweight_intake(record, policy, root, feature):
    data = record.get('lightweight')
    if not isinstance(data, dict):
        raise ValueError('lightweight work requires a lightweight record')
    validate_classification(policy, data)
    require_lightweight_history(root, feature)
    for field in ('scope', 'risk_rationale', 'author_role'):
        _text_required(data.get(field), 'lightweight work missing ' + field)
    flags = data.get('risk_flags')
    if not isinstance(flags, dict) or set(flags) != HIGH_RISK or any(
            value is not False for value in flags.values()):
        raise ValueError('lightweight work requires explicit false risk flags')
    return data


def _validate_lightweight(feature, target, record, policy, context, root):
    if target not in ('in_progress', 'done'):
        return {}
    data = _lightweight_intake(record, policy, root, feature)
    if target != 'done':
        return {}
    candidate = _candidate(root, record, context)
    review = record.get('closing_review')
    validate_closing_review(review, record['owner'], policy, candidate, require_human=False)
    validate_checks(record.get('checks'), candidate)
    validate_work(policy, {'author': data['author_role'], 'risk': 'lightweight',
                           'scope': data['scope'], 'risk_rationale': data['risk_rationale'],
                           'acceptance_evidence': data.get('acceptance_evidence'),
                           'closing_reviewer': review.get('role'),
                           'risk_flags': data['risk_flags']})
    return {'revision': candidate}


def validate_transition(feature, target, record, evidence, policy, context):
    """Return transition metadata or raise ValueError, without mutating anything."""
    if target not in STATUSES:
        raise ValueError('unsupported target status')
    current = feature.get('status')
    if current not in STATUSES:
        raise ValueError('feature status is invalid')
    feature_identity(feature)
    root = Path(context['root']).resolve()
    refuse_incomplete(root)
    pending = feature.get('pending_hook')
    if pending is not None and target != 'blocked':
        raise ValueError('failed lifecycle hook {} requires explicit recovery (workflow-recover)'
                         .format(pending.get('event') if isinstance(pending, dict) else pending))
    active = load_active_policy(root)
    policy = active if active is not None else policy
    if policy is None:
        if record is not None:
            raise ValueError('work records require an active team_policy')
        return _validate_unmanaged(feature, target, current, context, root)
    if record is None:
        raise ValueError('active team policy requires a work record for ' + feature['id'])
    validate_record(record)
    if record['feature_id'] != feature['id']:
        raise ValueError('feature and work record identifiers differ')
    if record['status'] != current:
        raise ValueError('feature_list and work record status differ')
    if (record['risk'] == 'full') != (feature.get('sdd') is not False):
        raise ValueError('work record risk does not match the feature sdd classification')
    if record.get('pending_hook') and target != 'blocked':
        raise ValueError('failed lifecycle hook {} requires explicit recovery (workflow-recover)'
                         .format(record['pending_hook'].get('event')))
    full = record['risk'] == 'full'
    # A missing blocked_from must not widen the return path, hence the empty default.
    _check_edge(current, target, context.get('reason'), record.get('blocked_from', ''),
                FULL_EDGES if full else LIGHT_EDGES)
    if target == 'in_progress':
        _check_concurrency(feature, context.get('feature_data'), policy)
    details = (_validate_full(feature, target, record, evidence, policy, context, root) if full
               else _validate_lightweight(feature, target, record, policy, context, root))
    details.update({'legacy': False, 'current': current, 'target': target})
    return details
