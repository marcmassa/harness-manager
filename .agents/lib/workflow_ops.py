"""State-changing workflow operations; each one validates the state it writes.

Transitions and record creation live here. Record-only updates are in
workflow_updates and repository validation in workflow_check; both are
re-exported so existing callers keep one entry point.
"""
import copy
from pathlib import Path
import subprocess

from approval import digest_from_spec_dir
from classification import (require_lightweight_history, require_new_record,
                            validate_classification)
import git_state
from team_policy import HIGH_RISK, load_active_policy, repository_path
from workflow import (find_feature, spec_directory, spec_state, validate_record,
                      validate_transition)
from workflow_check import check_repository  # noqa: F401
from workflow_io import (FEATURE_LIST, UNMANAGED, load_state, load_state_text,  # noqa: F401
                         managed, read_record, read_record_text, record_relative)
from workflow_store import (StateConflict, commit_transition, load_json, refuse_incomplete,
                            render_json, workflow_lock, write_state_json)
from workflow_updates import (add_evidence, record_approval, record_review,  # noqa: F401
                              record_scope_change, recover_hook, remove_evidence,
                              rollback_mutation, run_checks)
import safe_fs

HOOKS = {'spec_ready': 'on_spec_created', 'in_progress': 'on_spec_approved',
         'done': 'on_feature_done'}
COMMAND_EVENTS = {'on_implementation_start', 'on_implementation_complete', 'on_review_start',
                  'on_review_complete', 'on_check_pass'}


def registered_hooks(root_path, event):
    manifest = root_path / '.agents/agentic.json'
    if not event or not manifest.is_file():
        return []
    return [hook for hook in load_json(manifest).get('hooks', []) if hook.get('event') == event]


def _run_hooks(root_path, event, feature):
    command = [str(root_path / 'hooks/run-hooks.sh'), event, '--feature-id', feature['id'],
               '--feature-name', feature['name']]
    try:
        result = subprocess.run(command, cwd=str(root_path), stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, universal_newlines=True)
    except OSError as error:
        return 1, str(error)
    return result.returncode, result.stdout


def _started(event, target):
    return {'event': event, 'target': target, 'state': 'started',
            'recovery': 'human-confirmation-required'}


def _next_record(record, target, context, validation):
    updated = copy.deepcopy(record)
    current = record['status']
    updated['status'] = target
    if target == 'blocked':
        updated['blocked_from'] = current
        updated['blocked_reason'] = context['reason']
    elif current == 'blocked':
        updated.pop('blocked_from', None)
        updated.pop('blocked_reason', None)
    if current == 'done' and target == 'in_progress':
        updated.setdefault('completion_history', []).append({
            'reason': context['reason'], 'revision': record['revision'],
            'evidence': record.get('evidence'), 'checks': record.get('checks'),
            'closing_review': record.get('closing_review')})
        updated['evidence'] = []
        updated.pop('checks', None)
        updated.pop('closing_review', None)
    if validation.get('revision'):
        updated['revision'] = validation['revision']
    return updated


def _settle_hooks(root_path, feature, event, hooks):
    """Run hooks once, outside the lock; then record only their outcome on current state.

    A crash leaves the 'started' marker, which blocks like a failure. If the hook
    itself changed workflow state, the outcome is not guessed: an error is raised
    and the remaining marker requires workflow-recover.
    """
    code, output = _run_hooks(root_path, event, feature)
    required = any(hook.get('on_failure') == 'error' for hook in hooks)
    failure = {'event': event, 'state': 'failed', 'error': output[-2000:],
               'recovery': 'human-confirmation-required'}
    with workflow_lock(root_path):
        _root, list_text, data = load_state_text(root_path)
        current = find_feature(data, feature['id'])
        record_text, record = read_record_text(root_path, current)
        holder = record if record is not None else current
        marker = holder.get('pending_hook')
        if not isinstance(marker, dict) or marker.get('event') != event or \
                marker.get('state') != 'started':
            raise StateConflict('workflow state changed while the {} hook ran (exit {}); its '
                                'outcome was not recorded, inspect and run workflow-recover'
                                .format(event, code))
        failure['target'] = marker.get('target')
        if code == 0:
            holder.pop('pending_hook')
            outcome = {'hook_failed': False}
        elif required:
            holder['pending_hook'] = failure
            if record is not None:
                record.setdefault('hook_failures', []).append(failure)
            outcome = {'hook_failed': True, 'event': event}
        else:
            holder.pop('pending_hook')
            if record is not None:
                record.setdefault('hook_warnings', []).append(failure)
            outcome = {'hook_failed': False, 'hook_warning': event}
        if record is not None:
            validate_record(record)
            write_state_json(root_path, record_relative(current), record_text, record)
        else:
            write_state_json(root_path, FEATURE_LIST, list_text, data)
    return outcome


def mutate_transition(root, feature_id, target, context=None):
    """Validate the on-disk state under the lock, commit it with CAS, then run hooks."""
    root_path = Path(root).resolve()
    with workflow_lock(root_path):
        _root, list_text, data = load_state_text(root_path)
        refuse_incomplete(root_path)
        feature = find_feature(data, feature_id)
        if target == feature.get('status'):
            raise ValueError('transition must change status')
        policy = load_active_policy(root_path)
        record_text, record = read_record_text(root_path, feature)
        if policy is None and record is not None:
            raise ValueError('work records exist but team_policy is not active')
        merged = dict(context or {}, root=root_path, feature_data=data)
        validation = validate_transition(feature, target, record, (record or {}).get('evidence'),
                                         policy, merged)
        updated = copy.deepcopy(data)
        updated_feature = find_feature(updated, feature_id)
        updated_feature['status'] = target
        event = HOOKS.get(target)
        hooks = registered_hooks(root_path, event)
        if record is None:
            # Without a record the origin lives on the feature, so blocking cannot skip a gate.
            updated_feature.pop('blocked_from', None)
            if target == 'blocked':
                updated_feature['blocked_from'] = feature['status']
            if target == 'in_progress' and feature.get('sdd') is not False \
                    and 'spec_approval' not in feature:
                # Bind the spec as it stands when implementation starts; later edits are caught.
                updated_feature['spec_approval'] = dict(
                    spec_state(spec_directory(root_path, feature)),
                    assurance='recorded-at-transition-not-a-human-decision')
            if hooks:
                updated_feature['pending_hook'] = _started(event, target)
            write_state_json(root_path, FEATURE_LIST, list_text, updated)
        else:
            new_record = _next_record(record, target, merged, validation)
            if hooks:
                new_record['pending_hook'] = _started(event, target)
            commit_transition(root_path, feature_id, target, [
                (record_relative(feature), record_text, render_json(new_record)),
                (FEATURE_LIST, list_text, render_json(updated))])
    outcome = {'status': target, 'hook_failed': False, 'legacy': validation['legacy']}
    if 'approval' in validation:
        outcome['assurance'] = validation['approval']['assurance']
    elif validation['legacy']:
        outcome['assurance'] = validation['assurance']
    if hooks:
        outcome.update(_settle_hooks(root_path, updated_feature, event, hooks))
    return outcome


def run_lifecycle_hook(root, feature_id, event):
    """Run a command-level hook (review, implementation) with the same failure record."""
    if event not in COMMAND_EVENTS:
        raise ValueError('unsupported command hook event: ' + str(event))
    root_path = Path(root).resolve()
    hooks = registered_hooks(root_path, event)
    with workflow_lock(root_path):
        _root, list_text, data = load_state_text(root_path)
        refuse_incomplete(root_path)
        feature = find_feature(data, feature_id)
        record_text, record = read_record_text(root_path, feature)
        if load_active_policy(root_path) is not None and record is None:
            raise ValueError('active team policy requires a work record for ' + feature_id)
        holder = record if record is not None else feature
        if holder.get('pending_hook'):
            raise ValueError('a failed lifecycle hook is pending; run workflow-recover first')
        if not hooks:
            return {'event': event, 'hooks': 0, 'hook_failed': False}
        holder['pending_hook'] = _started(event, feature.get('status'))
        if record is not None:
            write_state_json(root_path, record_relative(feature), record_text, record)
        else:
            write_state_json(root_path, FEATURE_LIST, list_text, data)
    outcome = {'event': event, 'hooks': len(hooks)}
    outcome.update(_settle_hooks(root_path, feature, event, hooks))
    return outcome


def create_record(root, feature_id, owner, branch, worktree, dependencies=(), lightweight=None):
    """Register work before it starts; a deleted record is restored, never re-registered."""
    with workflow_lock(root):
        root_path, _text, data, policy = managed(root)
        feature = find_feature(data, feature_id)
        relative = record_relative(feature)
        full = feature.get('sdd') is not False
        status = feature.get('status')
        if full and lightweight:
            raise ValueError('sdd features use the full route; lightweight fields do not apply')
        if full and status not in ('pending', 'spec_ready'):
            raise ValueError('a full SDD record is created before implementation (pending or '
                             'spec_ready); {} is {}'.format(feature_id, status))
        if safe_fs.exists(root_path, relative):
            raise ValueError('work record already exists; existing owner was not replaced')
        require_new_record(root_path, relative, feature)
        record = {'format_version': 1, 'feature_id': feature['id'], 'status': status,
                  'owner': owner, 'branch': branch, 'worktree': worktree,
                  'dependencies': list(dependencies), 'revision': git_state.head(root_path),
                  'risk': 'full' if full else 'lightweight',
                  'spec_dir': 'specs/' + feature['name'] if full else None,
                  'approval': None, 'handoff': None, 'evidence': []}
        if not full:
            record['lightweight'] = _lightweight_intake(root_path, policy, feature, status,
                                                        lightweight)
        validate_record(record)
        try:
            safe_fs.create_exclusive(root_path, relative, render_json(record))
        except FileExistsError:
            raise ValueError('work record already exists; existing owner was not replaced')
    return {'created': relative, 'risk': record['risk']}


def _lightweight_intake(root_path, policy, feature, status, lightweight):
    if not lightweight:
        raise ValueError('non-sdd work requires scope, rationale, author role, and a human '
                         'classification decision')
    if status != 'pending':
        raise ValueError('lightweight classification is recorded before work starts; {} is {}'
                         .format(feature['id'], status))
    classification = {'decision': 'lightweight', 'authorized_by': lightweight.get('classified_by'),
                      'evidence_ref': lightweight.get('classification_ref'),
                      'risk_flags_declared_false': sorted(HIGH_RISK)}
    intake = {'scope': lightweight.get('scope'), 'risk_rationale': lightweight.get('risk_rationale'),
              'author_role': lightweight.get('author_role'),
              'risk_flags': {flag: False for flag in sorted(HIGH_RISK)},
              'classification': classification}
    validate_classification(policy, intake)
    require_lightweight_history(root_path, feature)
    return intake


def spec_digest_for(root, relative):
    root_path = Path(root).resolve()
    return digest_from_spec_dir(repository_path(root_path, relative, 'spec directory'))
