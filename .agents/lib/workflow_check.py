"""Revalidate all stored workflow state; run by check.sh through workflow-check.

Missing managed state fails: an active team_policy with no feature_list.json,
a symlinked or malformed record, an unrecovered hook, or a feature in a gated
status without a record. The only exception is a historical feature that was
already done at the policy's adoption_revision, before team_policy existed.
"""
import json
from pathlib import Path

import git_state
from safe_fs import list_directory
from team_policy import load_active_policy, repository_path, verify_scenario_acceptance
from workflow import (effective_max_concurrent, find_feature, spec_directory,
                      validate_feature_list, validate_record, validate_transition,
                      verify_spec_approval)
from workflow_store import FEATURE_LIST, load_json, read_state_json, refuse_incomplete

WORK = 'progress/work'
NO_RECORD_ALLOWED = {'pending', 'spec_ready', 'blocked'}


def work_record_names(root_path):
    """Record file names; anything but a regular .json file under that name is refused."""
    names = []
    for name, kind in list_directory(root_path, WORK):
        if name.startswith('.') or not name.endswith('.json'):
            continue
        if kind != 'file':
            raise ValueError('{}/{} must be a regular file, not a {}'.format(WORK, name, kind))
        names.append(name)
    return names


def _verify_scenarios(root_path, policy):
    manifest = load_json(root_path / '.agents/agentic.json')
    configured = manifest.get('team_policy_scenarios')
    if not configured:
        raise ValueError('an active team_policy requires reviewed team_policy_scenarios')
    scenarios = load_json(repository_path(root_path, configured, 'team_policy_scenarios'))
    verify_scenario_acceptance(root_path, policy, scenarios)


def _json_at(root_path, revision, relative):
    content = git_state.optional_blob_at(root_path, revision, relative, relative)
    if content is None:
        return None
    try:
        return json.loads(content.decode('utf-8'))
    except ValueError:
        raise ValueError('{} at adoption_revision is not valid JSON'.format(relative))


def historical_exemptions(root_path, data, policy, recorded):
    """Features exempt from records: done before adoption, and still done now."""
    historical = policy.get('historical_features', [])
    if not historical:
        return set()
    baseline = git_state.require_commit(root_path, policy['adoption_revision'], 'adoption_revision')
    git_state.require_ancestor(root_path, baseline, git_state.head(root_path), 'adoption_revision')
    manifest = _json_at(root_path, baseline, '.agents/agentic.json')
    if isinstance(manifest, dict) and manifest.get('team_policy'):
        raise ValueError('adoption_revision must predate team_policy activation')
    before = _json_at(root_path, baseline, FEATURE_LIST)
    done_then = set()
    if before is not None:
        done_then = {item.get('id') for item in validate_feature_list(before)['features']
                     if item.get('status') == 'done'}
    for identifier in historical:
        if identifier in recorded:
            raise ValueError(identifier + ' is in historical_features but has a work record')
        if find_feature(data, identifier).get('status') != 'done':
            raise ValueError(identifier + ' is historical but not done; reopening it requires '
                             'a work record and the full gates')
        if identifier not in done_then:
            raise ValueError(identifier + ' was not done at adoption_revision; only work closed '
                             'before adoption may be historical')
    return set(historical)


def _validate_record_file(root_path, data, policy, name):
    text, record = read_state_json(root_path, '{}/{}'.format(WORK, name))
    validate_record(record)
    feature = find_feature(data, record['feature_id'])
    if name != feature['name'] + '.json':
        raise ValueError('{} must be named {}.json'.format(name, feature['name']))
    pending = record.get('pending_hook')
    if pending:
        raise ValueError('{}: failed lifecycle hook {} requires explicit recovery '
                         '(workflow-recover)'.format(feature['id'], pending.get('event')))
    status = feature.get('status')
    if status not in ('spec_ready', 'in_progress', 'done'):
        if record['status'] != status:
            raise ValueError(feature['id'] + ': feature_list and work record status differ')
        return feature, record, None
    result = validate_transition(feature, status, record, record.get('evidence'), policy, {
        'root': root_path, 'feature_data': data, 'recorded_state': True})
    return feature, record, result


def check_repository(root):
    root_path = Path(root).resolve()
    refuse_incomplete(root_path)
    policy = load_active_policy(root_path)
    records = work_record_names(root_path)
    _text, data = read_state_json(root_path, FEATURE_LIST)
    if data is None:
        if policy is not None:
            raise ValueError('feature_list.json is missing while team_policy is active')
        if records:
            raise ValueError('work records exist without feature_list.json')
        return '[SKIP] strict workflow (no feature_list.json and no team_policy)'
    validate_feature_list(data)
    unrecovered = [item.get('id') for item in data['features'] if item.get('pending_hook')]
    if unrecovered:
        raise ValueError('failed lifecycle hook for {} requires explicit recovery '
                         '(workflow-recover)'.format(', '.join(map(str, unrecovered))))
    in_progress = [item for item in data['features'] if item.get('status') == 'in_progress']
    limit = effective_max_concurrent(data, policy)
    if len(in_progress) > limit:
        raise ValueError('maxConcurrent {} exceeded: {}'.format(
            limit, ', '.join(str(item.get('id')) for item in in_progress)))
    if policy is None:
        if records:
            raise ValueError('work records require team_policy; examples are not active defaults')
        bound = 0
        for item in in_progress:
            if item.get('spec_approval') is not None and item.get('sdd') is not False:
                find_feature(data, item.get('id'))
                verify_spec_approval(item, spec_directory(root_path, item))
                bound += 1
        return ('[SKIP] strict workflow (no team_policy opt-in; declared in .agents/agentic.json); '
                '{} in-progress approved spec(s) unchanged'.format(bound))
    _verify_scenarios(root_path, policy)
    seen, pending_trust = {}, 0
    for name in records:
        feature, record, result = _validate_record_file(root_path, data, policy, name)
        seen[feature['id']] = record
        if result and result.get('approval', {}).get('assurance') == 'pending-trusted-verification':
            pending_trust += 1
    historical = historical_exemptions(root_path, data, policy, seen)
    committed = git_state.paths_in_history(root_path, WORK + '/')
    for feature in data['features']:
        if feature.get('id') in seen or feature.get('id') in historical:
            continue
        if '{}/{}.json'.format(WORK, feature.get('name')) in committed:
            raise ValueError('{}: its committed work record is missing; restore it with git'
                             .format(feature.get('id')))
        if feature.get('status') not in NO_RECORD_ALLOWED:
            raise ValueError('{} is {} with no work record under the active team policy'.format(
                feature.get('id'), feature.get('status')))
    message = '[PASS] team policy and {} work record(s) validated'.format(len(seen))
    if pending_trust:
        message += ('; {} repository-mode approval(s) are pending-trusted-verification: only the '
                    'required trusted CI check at merge authenticates them'.format(pending_trust))
    return message
