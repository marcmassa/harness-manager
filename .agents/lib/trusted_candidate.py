"""Read a pull-request candidate as Git data and check its workflow claims.

Used only by trusted_verify.py. Every input is a blob read with `git cat-file`
from commits fetched into the trusted checkout; nothing from the candidate is
checked out, imported, or executed. The policy always comes from the trusted
base checkout, never from the candidate.
"""
import json

from approval import spec_digest, task_structure_digest, verify_approval
from evidence import requirement_ids, validate_checks, validate_evidence, validate_tasks
import git_state
from provider_review import full_sha
from workflow import ARTIFACTS, feature_identity, validate_feature_list, validate_record

GATED = ('in_progress', 'done')
NO_RECORD = ('pending', 'spec_ready', 'blocked')


def json_blob(root, revision, relative):
    content = git_state.optional_blob_at(root, revision, relative, 'workflow state')
    if content is None:
        return None
    try:
        return json.loads(content.decode('utf-8'))
    except ValueError:
        raise ValueError('{} at {} is not valid JSON'.format(relative, revision[:12]))


def spec_at(root, revision, name):
    """Approval digests computed from the regular-file blobs at revision."""
    blobs = {artifact: git_state.regular_blob_at(root, revision, 'specs/{}/{}'.format(name, artifact),
                                                 'spec artifact') for artifact in ARTIFACTS}
    return {'spec_digest': spec_digest(blobs['requirements.md'], blobs['design.md']),
            'task_digest': task_structure_digest(blobs['tasks.md']), 'blobs': blobs}


def features_in_scope(root, base, candidate):
    """Features whose spec, record, or feature_list entry the pull request changes."""
    merge = git_state.merge_base(root, base, candidate)
    paths = git_state.changed_paths(root, merge, candidate)
    after = json_blob(root, candidate, 'feature_list.json')
    if after is None:
        raise ValueError('candidate has no feature_list.json')
    before = json_blob(root, merge, 'feature_list.json') or {'features': []}
    previous = {item.get('id'): item for item in validate_feature_list(before)['features']}
    scope = []
    for feature in validate_feature_list(after)['features']:
        feature_identity(feature)
        prefix = 'specs/{}/'.format(feature['name'])
        record = 'progress/work/{}.json'.format(feature['name'])
        if previous.get(feature['id']) != feature or any(
                path.startswith(prefix) or path == record for path in paths):
            scope.append(feature)
    return merge, paths, scope


def _record_at(root, candidate, feature):
    record = json_blob(root, candidate, 'progress/work/{}.json'.format(feature['name']))
    if record is None:
        return None
    validate_record(record)
    if record['feature_id'] != feature['id'] or record['status'] != feature.get('status'):
        raise ValueError('{}: candidate work record is inconsistent with feature_list'.format(
            feature['id']))
    if (record['risk'] == 'full') != (feature.get('sdd') is not False):
        raise ValueError('{}: record risk does not match the sdd classification'.format(feature['id']))
    if record['risk'] == 'full' and record.get('spec_dir') != 'specs/' + feature['name']:
        raise ValueError('{}: spec_dir must be specs/{}'.format(feature['id'], feature['name']))
    if record.get('pending_hook'):
        raise ValueError('{}: unrecovered lifecycle hook in candidate'.format(feature['id']))
    return record


def _closure(root, candidate, feature, record, spec, policy):
    """Closing gate at the recorded revision, which must equal the candidate's code."""
    revision = full_sha(record['revision'], feature['id'] + ' closure revision')
    git_state.require_commit(root, revision, 'closure revision')
    git_state.require_ancestor(root, revision, candidate, 'closure revision')
    if not git_state.only_state_paths(git_state.changed_paths(root, revision, candidate)):
        raise ValueError('{}: candidate differs from its closure revision outside workflow '
                         'state; record evidence again for the reviewed code'.format(feature['id']))
    validate_tasks(spec['blobs']['tasks.md'].decode('utf-8'))
    identifiers = requirement_ids(spec['blobs']['requirements.md'].decode('utf-8'))
    validate_evidence(identifiers, record.get('evidence'), revision, root, policy, record['owner'],
                      working_tree=False)
    validate_checks(record.get('checks'), revision)
    return revision


def verify_feature(root, candidate, feature, policy, authenticate):
    """Return a summary for one in-scope feature, or raise with a precise reason.

    `authenticate(approval, spec_digest)` must return a TrustedRepositoryReview
    built from provider data, or raise.
    """
    status = feature.get('status')
    record = _record_at(root, candidate, feature)
    if record is None:
        if status in NO_RECORD:
            return {'feature': feature['id'], 'status': status, 'gate': 'no-record-required'}
        raise ValueError('{} is {} with no work record in the candidate'.format(feature['id'], status))
    if record['risk'] != 'full' or status not in GATED:
        return {'feature': feature['id'], 'status': status,
                'gate': 'code-review-only' if record['risk'] != 'full' else 'not-gated-at-status'}
    spec = spec_at(root, candidate, feature['name'])
    approval = record.get('approval')
    if not isinstance(approval, dict) or approval.get('review_mode') != 'repository':
        raise ValueError('{}: repository mode requires a repository approval record'.format(
            feature['id']))
    trusted = authenticate(approval, spec['spec_digest'])
    assurance = verify_approval(record, spec['spec_digest'], policy, trusted, spec['task_digest'],
                                candidate)
    summary = {'feature': feature['id'], 'status': status, 'gate': 'spec-approval',
               'spec_digest': spec['spec_digest'], 'reviewer': trusted.reviewer,
               'approval_pull_request': trusted.pull_request,
               'assurance': assurance['assurance']}
    if status == 'done':
        summary['closure_revision'] = _closure(root, candidate, feature, record, spec, policy)
        summary['gate'] = 'spec-approval-and-closure'
    return summary
