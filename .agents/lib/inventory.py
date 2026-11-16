#!/usr/bin/env python3
"""Framework versions and the installed-file inventory; standard library only.

The inventory (.harness/installed.json) records which framework release a
project installed, the format versions it uses, and a baseline SHA-256 for
every path the framework owns. Updates, cleanup, and removal work from that
list, never from whole directories. Nothing here changes a project file other
than the inventory itself.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys

LIB = Path(__file__).resolve().parent
VERSIONS = LIB.parent / 'schemas/versions.json'
INVENTORY = '.harness/installed.json'
VERSION = re.compile(r'^\d+\.\d+\.\d+$')
LEGACY = 'legacy'
SKIPPED_DIRECTORIES = {'.git', '.harness', '__pycache__', 'node_modules'}
# Created once at install and owned by the project afterwards; an update never replaces them.
SEED_FILES = {'feature_list.json', 'DESIGN.md', 'README.md', 'LICENSE', 'SECURITY.md',
              '.gitignore', '.agents/agentic.json'}
SEED_PREFIXES = ('progress/', 'steering/', 'examples/',
                 # Scaffolds a project replaces with its own roles and hooks during /init.
                 '.agents/subagents/harness/', '.agents/subagents/spec-author/',
                 '.agents/subagents/implementer/', '.agents/subagents/reviewer/',
                 '.agents/subagents/templates/', 'hooks/on-')


def declared():
    data = json.loads(VERSIONS.read_text(encoding='utf-8'))
    if not VERSION.match(str(data.get('framework_version'))):
        raise ValueError('versions.json framework_version must be MAJOR.MINOR.PATCH')
    return data


def version_key(text):
    if not isinstance(text, str) or not VERSION.match(text):
        raise ValueError('not a framework version: {!r}'.format(text))
    return tuple(int(part) for part in text.split('.'))


def require_format(kind, value):
    """Refuse an unknown format version with the supported range and the way forward."""
    formats = declared()['formats'][kind]
    if isinstance(value, bool) or value not in formats['supported']:
        raise ValueError(
            'unsupported {} format_version {!r}; this framework ({}) supports {}. Update the '
            'framework, or migrate the file, before changing anything.'.format(
                kind, value, declared()['framework_version'],
                ', '.join(str(item) for item in formats['supported'])))
    return value


def check_manifest(root):
    """A manifest without `version` predates versioning and is read as format 1."""
    path = Path(root) / '.agents/agentic.json'
    if not path.is_file():
        return None
    try:
        manifest = json.loads(path.read_text(encoding='utf-8'))
    except ValueError as error:
        raise ValueError('.agents/agentic.json is not valid JSON: {}'.format(error))
    if not isinstance(manifest, dict):
        raise ValueError('.agents/agentic.json must be an object')
    return require_format('manifest', manifest.get('version', 1))


def plain_path(relative):
    path = PurePosixPath(relative) if isinstance(relative, str) else None
    # as_posix() must round-trip: 'a/./b' and 'a//b' normalize silently and are refused.
    if path is None or path.is_absolute() or not path.parts or '\\' in relative \
            or '..' in path.parts or path.as_posix() != relative:
        raise ValueError('inventory path must be a plain relative path: {!r}'.format(relative))
    return path.as_posix()


def ownership(relative):
    if relative in SEED_FILES or relative.startswith(SEED_PREFIXES):
        return 'seed'
    # Synced skills come from the registry (sync-skills.sh), not from a framework release.
    if relative.startswith('.agents/skills/') and relative.count('/') > 2:
        return 'seed'
    if relative.startswith('specs/') and relative != 'specs/README.md' \
            and not relative.startswith('specs/templates/'):
        return 'seed'
    return 'framework'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def payload(root):
    """Regular files below root, as sorted relative paths; symlinks are never owned."""
    root = Path(root)
    found = []
    for folder, names, files in os.walk(str(root)):
        names[:] = sorted(name for name in names if name not in SKIPPED_DIRECTORIES
                          and not (Path(folder) / name).is_symlink())
        for name in files:
            path = Path(folder) / name
            if path.is_symlink() or not path.is_file() or name.endswith('.pyc'):
                continue
            found.append(path.relative_to(root).as_posix())
    return sorted(found)


def _document(framework_version, files, adopted=None):
    formats = declared()['formats']
    document = {'format_version': formats['inventory']['current'],
                'framework_version': framework_version,
                'manifest_format': formats['manifest']['current'],
                'work_record_format': formats['work_record']['current'],
                'files': files}
    if adopted is not None:
        document['adopted'] = adopted
    return document


def _write(root, document):
    target = Path(root) / INVENTORY
    if target.parent.is_symlink() or target.is_symlink():
        raise ValueError('.harness must not be a symlink')
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(document, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def create(root):
    """Record a fresh install: every installed file, its owner class, and its baseline digest."""
    root = Path(root).resolve()
    if (root / INVENTORY).exists():
        raise ValueError(INVENTORY + ' already exists; an install is recorded once')
    files = {relative: {'sha256': digest(root / relative), 'ownership': ownership(relative)}
             for relative in payload(root)}
    _write(root, _document(declared()['framework_version'], files))
    return {'created': INVENTORY, 'framework_version': declared()['framework_version'],
            'files': len(files)}


def load(root):
    """Return the validated inventory, or None when the project has none."""
    path = Path(root) / INVENTORY
    if path.is_symlink():
        raise ValueError(INVENTORY + ' must not be a symlink')
    if not path.is_file():
        return None
    try:
        document = json.loads(path.read_text(encoding='utf-8'))
    except ValueError as error:
        raise ValueError('{} is not valid JSON: {}'.format(INVENTORY, error))
    if not isinstance(document, dict):
        raise ValueError(INVENTORY + ' must be an object')
    require_format('inventory', document.get('format_version'))
    require_format('manifest', document.get('manifest_format'))
    require_format('work_record', document.get('work_record_format'))
    installed = document.get('framework_version')
    if installed != LEGACY and version_key(installed) > version_key(declared()['framework_version']):
        raise ValueError('{} was written by framework {}, newer than this framework ({}); '
                         'update the framework before changing anything'.format(
                             INVENTORY, installed, declared()['framework_version']))
    files = document.get('files')
    if not isinstance(files, dict):
        raise ValueError(INVENTORY + ' files must be an object')
    for relative, entry in files.items():
        plain_path(relative)
        baseline = entry.get('sha256') if isinstance(entry, dict) else 0
        if not isinstance(entry, dict) or entry.get('ownership') not in ('framework', 'seed') \
                or not (baseline is None or re.match(r'^[0-9a-f]{64}$', str(baseline))):
            raise ValueError('{} entry for {} is malformed'.format(INVENTORY, relative))
    return document


def status(root):
    """Compare owned files with their baselines. Read-only."""
    root = Path(root).resolve()
    document = load(root)
    if document is None:
        return None
    result = {'unchanged': [], 'modified': [], 'missing': [], 'uncertain': []}
    for relative, entry in sorted(document['files'].items()):
        path = root / relative
        if path.is_symlink() or not path.is_file():
            result['missing'].append(relative)
        elif entry['sha256'] is None:
            result['uncertain'].append(relative)
        else:
            result['unchanged' if digest(path) == entry['sha256'] else 'modified'].append(relative)
    return document, result


def adopt(root, release_root, known=None):
    """Give an install that predates inventories one, judged against a known release tree.

    A file identical to the release is owned with that baseline. `known` maps a
    path to the digests of its earlier published versions: a file equal to one
    of them is an untouched older release, owned with its current digest, and
    updates may replace it. Any other file cannot be told apart from a local
    edit, so it is recorded as uncertain (no baseline) and every later update
    treats it as a conflict. Starter files and files the release does not ship
    are not recorded: they stay the project's.
    """
    root, release_root = Path(root).resolve(), Path(release_root).resolve()
    if (root / INVENTORY).exists():
        raise ValueError(INVENTORY + ' already exists; adoption applies only to installs without one')
    release = load(release_root)
    if release is None:
        raise ValueError('the release tree has no {}; pass a directory produced by '
                         './.agents/bootstrap.sh export'.format(INVENTORY))
    if not declared()['update_from'].get('legacy_adoption'):
        raise ValueError('this framework release does not support legacy adoption')
    files, matched, earlier, uncertain = {}, 0, 0, 0
    for relative, entry in sorted(release['files'].items()):
        path = root / relative
        if path.is_symlink() or not path.is_file():
            continue
        current = digest(path)
        if entry['ownership'] == 'seed':
            pass  # the project's own file from the start; its content is not judged
        elif current == entry['sha256']:
            matched += 1
        elif current in (known or {}).get(relative, ()):
            earlier += 1
        else:
            uncertain += 1
            current = None
        files[relative] = {'sha256': current, 'ownership': entry['ownership']}
    if not files:
        raise ValueError('no file of this project matches the release; is this a Harness SDD install?')
    _write(root, _document(LEGACY, files, adopted={
        'compared_with': release['framework_version'], 'matched': matched,
        'earlier_release': earlier, 'uncertain': uncertain}))
    return {'created': INVENTORY, 'framework_version': LEGACY, 'matched': matched,
            'earlier_release': earlier, 'uncertain': uncertain}


def describe(root):
    data = declared()
    lines = ['framework {}'.format(data['framework_version'])]
    for kind in ('manifest', 'work_record', 'inventory'):
        lines.append('{} format {} (supported: {})'.format(
            kind, data['formats'][kind]['current'],
            ', '.join(str(item) for item in data['formats'][kind]['supported'])))
    lines.append('updates from {} or later; older installs use inventory-adopt'.format(
        data['update_from']['minimum']))
    found = status(root)
    if found is None:
        lines.append('installed: no {} (this is the framework source, or a legacy install)'
                     .format(INVENTORY))
    else:
        document, result = found
        lines.append('installed: {} — {} unchanged, {} modified, {} missing, {} uncertain'.format(
            document['framework_version'], len(result['unchanged']), len(result['modified']),
            len(result['missing']), len(result['uncertain'])))
    return '\n'.join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--create', action='store_true')
    action.add_argument('--adopt', metavar='RELEASE_TREE')
    action.add_argument('--check', action='store_true', help='validate format versions; read-only')
    action.add_argument('--describe', action='store_true')
    args = parser.parse_args(argv)
    try:
        if args.create:
            print(json.dumps(create(args.root), sort_keys=True))
        elif args.adopt:
            print(json.dumps(adopt(args.root, args.adopt), sort_keys=True))
        elif args.check:
            check_manifest(args.root)
            load(args.root)
        else:
            print(describe(args.root))
    except (ValueError, OSError, KeyError) as error:
        print('[FAIL] versions: {}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
