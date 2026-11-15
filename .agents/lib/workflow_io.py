"""Locked, symlink-safe loading and compare-and-swap saving of workflow state.

Every operation that changes state reads feature_list.json and the work record
under the workflow lock, validates exactly the text it read, and writes only if
that text is still on disk. Concurrent commands therefore serialize, and a
stale snapshot can never overwrite a newer record.
"""
from pathlib import Path

from team_policy import load_active_policy
from workflow import find_feature, validate_feature_list, validate_record
from workflow_store import (FEATURE_LIST, read_state_json, refuse_incomplete,  # noqa: F401
                            workflow_lock, write_state_json)

UNMANAGED = 'this operation requires an active team_policy in .agents/agentic.json'


def record_relative(feature):
    return 'progress/work/{}.json'.format(feature['name'])


def load_state_text(root):
    root_path = Path(root).resolve()
    text, data = read_state_json(root_path, FEATURE_LIST)
    if text is None:
        raise ValueError('feature_list.json not found')
    return root_path, text, validate_feature_list(data)


def load_state(root):
    root_path, _text, data = load_state_text(root)
    return root_path, data


def read_record_text(root_path, feature):
    """Return (text, record) or (None, None); symlinks and malformed JSON are refused."""
    text, record = read_state_json(root_path, record_relative(feature))
    if text is not None:
        validate_record(record)
    return text, record


def read_record(root_path, feature):
    return read_record_text(root_path, feature)[1]


def managed(root):
    """Load what a record-changing operation needs, refusing unmanaged projects."""
    root_path, text, data = load_state_text(root)
    refuse_incomplete(root_path)
    policy = load_active_policy(root_path)
    if policy is None:
        raise ValueError(UNMANAGED)
    return root_path, text, data, policy


def update_record(root, feature_id, mutate):
    """Apply mutate(root_path, feature, policy, record) to the current record, atomically."""
    with workflow_lock(root):
        root_path, _text, data, policy = managed(root)
        feature = find_feature(data, feature_id)
        text, record = read_record_text(root_path, feature)
        if record is None:
            raise ValueError('no work record for {}; run workflow-init first'.format(feature_id))
        if record['feature_id'] != feature['id'] or record['status'] != feature.get('status'):
            raise ValueError('work record is inconsistent with feature_list')
        result = mutate(root_path, feature, policy, record)
        validate_record(record)
        write_state_json(root_path, record_relative(feature), text, record)
    return result
