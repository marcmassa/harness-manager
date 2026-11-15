#!/usr/bin/env python3
"""Plan, apply, and restore a framework update in an installed project.

Run from the framework source against a project:

    plan     non-mutating per-file plan from the project's inventory
    apply    applies exactly the plan whose digest is given; backs up first
    restore  undoes the last applied or interrupted update
    keep     marks conflicting paths as project-owned (never updated again)
    accept   resolves named conflicts by taking the release version, with backup
    adopt    gives a legacy project an inventory (see inventory.py)

Three-way rule: a file is replaced only if it still equals its installed
baseline. A locally changed, deleted, or uncertain file is a conflict and is
left alone; the incoming version is saved beside the backup for manual merge.
Files outside the inventory are never touched. Standard library only.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import git_state
import inventory
from inventory import INVENTORY, LEGACY, digest, plain_path, version_key

BACKUPS = '.harness/backups'
MUTATING = ('add', 'replace', 'remove')


def _blocked(root, relative):
    """Reason a path must not be read or written: a symlink on the way, or a non-file."""
    current = Path(root)
    parts = Path(plain_path(relative)).parts
    for index, part in enumerate(parts):
        current = current / part
        if current.is_symlink():
            return 'symlink in path'
        if index < len(parts) - 1 and current.exists() and not current.is_dir():
            return 'parent is not a directory'
    if current.exists() and not current.is_file():
        return 'not a regular file'
    return None


def _state(root, relative):
    """(digest or None when absent, blocking reason or None)."""
    reason = _blocked(root, relative)
    if reason:
        return None, reason
    path = Path(root) / relative
    return (digest(path) if path.is_file() else None), None


def _decide(relative, installed, incoming, current):
    """Return (action, reason) for one path; `installed`/`incoming` are inventory entries or None."""
    if incoming is None:
        if installed['ownership'] == 'seed':
            return 'keep', 'project-owned'
        if current is None:
            return 'forget', 'already absent'
        if installed['sha256'] is not None and current == installed['sha256']:
            return 'remove', 'no longer shipped'
        return 'conflict', 'no longer shipped, but changed locally'
    if incoming['ownership'] == 'seed' or (installed and installed['ownership'] == 'seed'):
        # Starter files belong to a fresh install; an update never adds or replaces them.
        return 'keep', 'project-owned or starter file'
    if current == incoming['sha256']:
        return 'current', 'already up to date'
    if current is None:
        return ('add', 'new file') if installed is None else ('conflict', 'deleted locally')
    if installed is None:
        return 'conflict', 'a file of the project occupies this path'
    if installed['sha256'] is None:
        return 'conflict', 'uncertain baseline (legacy adoption)'
    if current == installed['sha256']:
        return 'replace', 'unchanged since install'
    return 'conflict', 'changed locally'


def plan_update(root, release):
    """Compute the plan. Reads only."""
    root, release = Path(root).resolve(), Path(release).resolve()
    installed = inventory.load(root)
    if installed is None:
        raise ValueError('the project has no {}; run update-adopt first'.format(INVENTORY))
    incoming = inventory.load(release)
    if incoming is None:
        raise ValueError('the release has no ' + INVENTORY)
    source, target = installed['framework_version'], incoming['framework_version']
    minimum = inventory.declared()['update_from']['minimum']
    if source != LEGACY:
        if version_key(source) > version_key(target):
            raise ValueError('refusing to downgrade from {} to {}'.format(source, target))
        if version_key(source) < version_key(minimum):
            raise ValueError('installed {} is older than the supported minimum {}'.format(
                source, minimum))
    pending = [path.name for path in sorted((root / BACKUPS).glob('*')) if _journal_state(path) == 'started'] \
        if (root / BACKUPS).is_dir() and not (root / BACKUPS).is_symlink() else []
    if pending:
        raise ValueError('interrupted update {} must be restored first (update-restore)'.format(
            pending[0]))
    actions = []
    for relative in sorted(set(installed['files']) | set(incoming['files'])):
        current, blocked = _state(root, relative)
        new = incoming['files'].get(relative)
        if new is not None and _blocked(release, relative):
            raise ValueError('release file is not a regular file: ' + relative)
        if blocked:
            action, reason = 'conflict', blocked
        else:
            action, reason = _decide(relative, installed['files'].get(relative), new, current)
        actions.append({'path': relative, 'action': action, 'reason': reason, 'current': current,
                        'new': new['sha256'] if new else None})
    body = {'from': source, 'to': target, 'actions': actions}
    body['plan_digest'] = hashlib.sha256(
        json.dumps(body, sort_keys=True).encode('utf-8')).hexdigest()
    return body


def _journal_state(folder):
    try:
        return json.loads((folder / 'journal.json').read_text(encoding='utf-8')).get('state')
    except (OSError, ValueError):
        return None


def _write_json(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    os.replace(str(temporary), str(path))


def _copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.harness-update')
    shutil.copy2(str(source), str(temporary))
    os.replace(str(temporary), str(target))


def _mutate(root, release, item):
    """Apply one action after rechecking that the file is still what the plan saw."""
    current, blocked = _state(root, item['path'])
    if blocked or current != item['current']:
        raise ValueError('{} changed after planning; nothing more was applied'.format(item['path']))
    if item['action'] == 'remove':
        (root / item['path']).unlink()
    else:
        _copy(release / item['path'], root / item['path'])


def _next_inventory(installed, incoming, plan):
    files = {}
    for item in plan['actions']:
        relative, action = item['path'], item['action']
        if action in ('add', 'replace', 'current'):
            files[relative] = dict(incoming['files'][relative])
        elif action in ('keep', 'conflict') and relative in installed['files']:
            files[relative] = dict(installed['files'][relative])
    document = dict(incoming, files=files)
    conflicts = [item['path'] for item in plan['actions'] if item['action'] == 'conflict']
    if conflicts:
        document['conflicts'] = conflicts
    return document


def apply_update(root, release, plan_digest):
    """Apply the reviewed plan, or nothing if the project changed since it was reviewed."""
    root, release = Path(root).resolve(), Path(release).resolve()
    plan = plan_update(root, release)
    if plan['plan_digest'] != plan_digest:
        raise ValueError('the project or the release changed since the plan was reviewed; '
                         'run update-plan again')
    if _blocked(root, BACKUPS + '/x'):
        raise ValueError('.harness must not contain symlinks')
    identifier = '{}-{}'.format(plan['to'], plan_digest[:12])
    folder = root / BACKUPS / identifier
    if folder.exists():
        raise ValueError('update {} was already applied'.format(identifier))
    work = [item for item in plan['actions'] if item['action'] in MUTATING]
    conflicts = [item for item in plan['actions'] if item['action'] == 'conflict']
    folder.mkdir(parents=True)
    # Back up everything first, then record intent, then change files.
    shutil.copy2(str(root / INVENTORY), str(folder / 'installed.json'))
    for item in work:
        if item['current'] is not None:
            _copy(root / item['path'], folder / 'before' / item['path'])
    for item in conflicts:
        if item['new'] is not None:
            _copy(release / item['path'], folder / 'incoming' / item['path'])
    journal = {'id': identifier, 'state': 'started', 'from': plan['from'], 'to': plan['to'],
               'actions': [{'path': item['path'], 'action': item['action'],
                            'before': item['current'], 'after': item['new']} for item in work],
               'conflicts': [{'path': item['path'], 'reason': item['reason']} for item in conflicts]}
    _write_json(folder / 'journal.json', journal)
    for item in work:
        _mutate(root, release, item)
    _write_json(root / INVENTORY, _next_inventory(inventory.load(root), inventory.load(release), plan))
    journal['state'] = 'complete'
    _write_json(folder / 'journal.json', journal)
    return journal


def restore_update(root, overwrite_edits=False):
    """Return the project to its state before the most recent applied or interrupted update."""
    root = Path(root).resolve()
    base = root / BACKUPS
    if _blocked(root, BACKUPS + '/x') or not base.is_dir():
        raise ValueError('no update to restore')
    candidates = [path for path in sorted(base.iterdir(), key=lambda p: p.stat().st_mtime)
                  if _journal_state(path) in ('started', 'complete')]
    if not candidates:
        raise ValueError('no update to restore')
    folder = candidates[-1]
    journal = json.loads((folder / 'journal.json').read_text(encoding='utf-8'))
    steps, edited = [], []
    for item in journal['actions']:
        plain_path(item['path'])
        current, blocked = _state(root, item['path'])
        if blocked:
            edited.append(item['path'])
        elif current == item['before']:
            continue  # this step never ran, or was already undone
        elif current == item['after'] or overwrite_edits:
            steps.append(item)
        else:
            edited.append(item['path'])
    if edited and not overwrite_edits:
        raise ValueError('edited after the update, restore would overwrite: {}. Rerun with '
                         '--overwrite-edits to discard those edits.'.format(', '.join(edited)))
    for item in steps:
        if item['before'] is None:
            if (root / item['path']).is_file():
                (root / item['path']).unlink()
        else:
            _copy(folder / 'before' / item['path'], root / item['path'])
    _copy(folder / 'installed.json', root / INVENTORY)
    journal['state'] = 'restored'
    _write_json(folder / 'journal.json', journal)
    serial = 1
    while (base / '{}.restored-{}'.format(folder.name, serial)).exists():
        serial += 1
    folder.rename(base / '{}.restored-{}'.format(folder.name, serial))
    return {'restored': journal['id'], 'files': len(steps)}


def keep(root, paths):
    """Hand conflicting paths to the project: updates will never propose them again."""
    root = Path(root).resolve()
    document = inventory.load(root)
    if document is None:
        raise ValueError('the project has no ' + INVENTORY)
    for relative in paths:
        if plain_path(relative) not in document['files']:
            raise ValueError(relative + ' is not in the inventory')
        document['files'][relative]['ownership'] = 'seed'
    if 'conflicts' in document:
        document['conflicts'] = [path for path in document['conflicts'] if path not in paths]
    _write_json(root / INVENTORY, document)
    return {'project_owned': sorted(paths)}


def accept(root, release, paths):
    """Resolve named conflicts by installing the release version; restore can undo it."""
    root, release = Path(root).resolve(), Path(release).resolve()
    plan = plan_update(root, release)
    by_path = {item['path']: item for item in plan['actions']}
    chosen = []
    for relative in paths:
        item = by_path.get(plain_path(relative))
        if item is None or item['action'] != 'conflict' or item['new'] is None:
            raise ValueError('{} is not a conflict with an incoming version'.format(relative))
        if _blocked(root, relative):
            raise ValueError('{} cannot be replaced: {}'.format(relative, _blocked(root, relative)))
        chosen.append(item)
    if not chosen:
        raise ValueError('name at least one conflicting path')
    names = sorted(item['path'] for item in chosen)
    identifier = 'accept-' + hashlib.sha256(json.dumps(
        [plan['plan_digest'], names]).encode('utf-8')).hexdigest()[:12]
    folder = root / BACKUPS / identifier
    if _blocked(root, BACKUPS + '/x') or folder.exists():
        raise ValueError('cannot create the backup for ' + identifier)
    folder.mkdir(parents=True)
    shutil.copy2(str(root / INVENTORY), str(folder / 'installed.json'))
    for item in chosen:
        if item['current'] is not None:
            _copy(root / item['path'], folder / 'before' / item['path'])
    journal = {'id': identifier, 'state': 'started', 'from': plan['from'], 'to': plan['to'],
               'conflicts': [], 'actions': [{'path': item['path'], 'action': 'replace',
                                             'before': item['current'], 'after': item['new']}
                                            for item in chosen]}
    _write_json(folder / 'journal.json', journal)
    document, incoming = inventory.load(root), inventory.load(release)
    for item in chosen:
        _mutate(root, release, item)
        document['files'][item['path']] = dict(incoming['files'][item['path']])
    if 'conflicts' in document:
        document['conflicts'] = [path for path in document['conflicts'] if path not in names]
    _write_json(root / INVENTORY, document)
    journal['state'] = 'complete'
    _write_json(folder / 'journal.json', journal)
    return {'accepted': names, 'backup': '{}/{}'.format(BACKUPS, identifier)}


def render_plan(plan):
    lines = ['update {} -> {}'.format(plan['from'], plan['to'])]
    counts = {}
    for item in plan['actions']:
        counts[item['action']] = counts.get(item['action'], 0) + 1
        if item['action'] in MUTATING + ('conflict',):
            lines.append('  {:<8} {}  ({})'.format(item['action'], item['path'], item['reason']))
    lines.append('summary: ' + ', '.join('{} {}'.format(counts[name], name) for name in sorted(counts)))
    lines.append('plan digest: ' + plan['plan_digest'])
    return '\n'.join(lines)


def known_versions(source, release):
    """Digests of every published version of each release path, from the source's Git history."""
    known = {}
    try:
        for relative in inventory.load(release)['files']:
            known[relative] = {hashlib.sha256(content).hexdigest()
                               for _commit, content in git_state.historical_versions(source, relative)}
    except ValueError:
        return {}
    return known


def build_release(source, folder):
    """Export the framework source into folder; the export is the release being installed."""
    result = subprocess.run([str(Path(source) / '.agents/bootstrap.sh'), 'export', str(folder)],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True,
                            env={k: v for k, v in os.environ.items() if k != 'ROOT_DIR'})
    if result.returncode:
        raise ValueError('could not export the framework release: ' + result.stdout[-500:])
    return Path(folder)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', help='framework source to export as the release')
    parser.add_argument('--release', help='an already exported release directory')
    parser.add_argument('operation', choices=('plan', 'apply', 'restore', 'keep', 'accept', 'adopt'))
    parser.add_argument('project')
    parser.add_argument('paths', nargs='*')
    parser.add_argument('--plan', dest='plan_digest')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--overwrite-edits', action='store_true')
    args = parser.parse_args(argv)
    try:
        project = Path(args.project).resolve()
        if not project.is_dir():
            raise ValueError('project directory not found: ' + args.project)
        if args.operation == 'restore':
            print(json.dumps(restore_update(project, args.overwrite_edits), sort_keys=True))
            return 0
        if args.operation == 'keep':
            print(json.dumps(keep(project, args.paths), sort_keys=True))
            return 0
        with tempfile.TemporaryDirectory(prefix='harness-release-') as temporary:
            release = Path(args.release) if args.release else build_release(
                args.source, Path(temporary) / 'release')
            if args.operation == 'accept':
                print(json.dumps(accept(project, release, args.paths), sort_keys=True))
            elif args.operation == 'adopt':
                known = known_versions(Path(args.source).resolve(), release) if args.source else {}
                print(json.dumps(inventory.adopt(project, release, known), sort_keys=True))
            elif args.operation == 'plan':
                plan = plan_update(project, release)
                print(json.dumps(plan, sort_keys=True) if args.json else render_plan(plan))
            else:
                if not args.plan_digest:
                    raise ValueError('apply needs --plan <digest> from a reviewed update-plan')
                journal = apply_update(project, release, args.plan_digest)
                print(json.dumps({'applied': journal['id'], 'changed': len(journal['actions']),
                                  'conflicts': [c['path'] for c in journal['conflicts']],
                                  'backup': '{}/{}'.format(BACKUPS, journal['id'])}, sort_keys=True))
    except (ValueError, OSError, KeyError) as error:
        print('[FAIL] update: {}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
