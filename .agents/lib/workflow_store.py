"""Workflow state persistence: symlink-safe reads, compare-and-swap writes, journal.

os.rename makes one file atomic; it cannot make feature_list.json and a work
record change together. The journal records intent first, so a crash between
writes is detected instead of being mistaken for a consistent state. Recovery
only restores the prior state; the transition is then rerun and revalidated.

Every mutation runs under safe_fs.workflow_lock and writes only if each file
still holds the exact text that was validated, so a stale snapshot never
overwrites a newer file.
"""
import json
from pathlib import Path, PurePosixPath

import safe_fs
from safe_fs import StateConflict, workflow_lock  # noqa: F401  (re-exported)

JOURNAL = 'progress/work/.transition-journal.json'
FEATURE_LIST = 'feature_list.json'


def load_json(path):
    """Read JSON from a path outside workflow state (manifest, schema, policy)."""
    return json.loads(Path(path).read_text(encoding='utf-8'))


def parse_json(text, label):
    try:
        return json.loads(text)
    except ValueError as error:
        raise ValueError('{} is not valid JSON: {}'.format(label, error))


def render_json(value):
    return json.dumps(value, indent=2, ensure_ascii=False) + '\n'


def read_state_text(root, relative):
    return safe_fs.read_text(root, relative)


def read_state_json(root, relative):
    """Return (text, value) for a state file, or (None, None) when absent."""
    text = safe_fs.read_text(root, relative)
    return (None, None) if text is None else (text, parse_json(text, relative))


def write_state_json(root, relative, expected_text, value):
    safe_fs.write_if_unchanged(root, relative, expected_text, render_json(value))


def journal_path(root):
    """Location of the journal, for diagnostics; access it only through safe_fs."""
    return Path(root) / JOURNAL


def refuse_incomplete(root):
    if safe_fs.exists(root, JOURNAL):
        raise ValueError('incomplete workflow mutation detected ({}); inspect it, then run '
                         './.agents/bootstrap.sh workflow-rollback'.format(JOURNAL))


def _allowed_journal_path(relative):
    if relative == FEATURE_LIST:
        return True
    path = PurePosixPath(relative)
    return (not path.is_absolute() and len(path.parts) == 3 and path.parts[:2] == ('progress', 'work')
            and path.suffix == '.json' and not path.name.startswith('.')
            and '..' not in path.parts)


def _begin(root, feature_id, target, entries):
    body = render_json({'format_version': 1, 'feature_id': feature_id, 'target': target,
                        'files': entries})
    try:
        safe_fs.create_exclusive(root, JOURNAL, body)
    except FileExistsError:
        refuse_incomplete(root)
        raise


def commit_transition(root, feature_id, target, changes):
    """Apply [(relative, before_text, after_text)] under the lock and a write-ahead journal.

    `before_text` must be the text the caller validated. If any file differs now,
    nothing is written (compare-and-swap), so a stale snapshot cannot win.
    """
    entries = [{'path': relative, 'before': before, 'after': after}
               for relative, before, after in changes]
    with workflow_lock(root):
        refuse_incomplete(root)
        for entry in entries:
            if not _allowed_journal_path(entry['path']):
                raise ValueError('transition names a path outside workflow state')
            if not isinstance(entry['before'], str):
                raise ValueError('transition requires the validated prior text of ' + entry['path'])
            if safe_fs.read_text(root, entry['path']) != entry['before']:
                raise StateConflict('{} changed after validation; nothing was written, rerun '
                                    'the transition'.format(entry['path']))
        _begin(root, feature_id, target, entries)
        try:
            for entry in entries:
                safe_fs.write_text(root, entry['path'], entry['after'])
        except Exception:
            # An ordinary failure can undo itself. A hard crash skips this and is
            # caught later because the journal remains on disk.
            for entry in entries:
                safe_fs.write_text(root, entry['path'], entry['before'])
            safe_fs.unlink(root, JOURNAL)
            raise
        safe_fs.unlink(root, JOURNAL)


def _journal_entries(text):
    journal = parse_json(text, JOURNAL)
    if not isinstance(journal, dict) or journal.get('format_version') != 1:
        raise ValueError('unsupported or malformed transition journal; resolve it manually')
    entries = journal.get('files')
    if not isinstance(entries, list) or not entries or not isinstance(journal.get('feature_id'), str):
        raise ValueError('unsupported or malformed transition journal; resolve it manually')
    seen = set()
    for entry in entries:
        relative = entry.get('path') if isinstance(entry, dict) else None
        if not isinstance(relative, str) or not _allowed_journal_path(relative):
            raise ValueError('transition journal names a path outside workflow state')
        if relative in seen:
            raise ValueError('transition journal names a file twice')
        seen.add(relative)
        for side in ('before', 'after'):
            if not isinstance(entry.get(side), str):
                raise ValueError('transition journal entry is incomplete')
            if not isinstance(parse_json(entry[side], '{} {} text'.format(relative, side)), dict):
                raise ValueError('transition journal {} text of {} is not an object'.format(
                    side, relative))
    return journal, entries


def rollback_incomplete(root):
    """Restore pre-mutation contents; refuse if anything changed beyond the journal."""
    with workflow_lock(root):
        if not safe_fs.exists(root, JOURNAL):
            raise ValueError('no incomplete workflow mutation is recorded')
        text = safe_fs.read_text(root, JOURNAL)
        journal, entries = _journal_entries(text)
        for entry in entries:
            current = safe_fs.read_text(root, entry['path'])
            if current not in (entry['before'], entry['after']):
                raise ValueError('{} changed after the interrupted mutation; resolve it manually'
                                 .format(entry['path']))
        for entry in entries:
            safe_fs.write_text(root, entry['path'], entry['before'])
        safe_fs.unlink(root, JOURNAL)
    return {'rolled_back': journal['feature_id'], 'attempted_target': journal.get('target')}
