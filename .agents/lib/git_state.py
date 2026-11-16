"""Read-only Git queries that bind workflow records to real candidate revisions."""
import os
from pathlib import Path
import re
import subprocess

OBJECT_ID = re.compile(r'^[0-9a-f]{40}(?:[0-9a-f]{24})?$')
# Workflow state is written after the candidate is reviewed, so it cannot be part
# of the candidate itself. Everything else must match the commit being closed.
STATE_PATHS = ('feature_list.json', 'progress/')


def _git(root, *args):
    environment = {key: value for key, value in os.environ.items()
                   if not key.startswith('GIT_')}
    return subprocess.run(['git', '--literal-pathspecs', '-C', str(root)] + list(args),
                          env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def require_repository(root):
    """Refuse a directory that is merely nested inside some other repository."""
    result = _git(root, 'rev-parse', '--show-toplevel')
    if result.returncode:
        raise ValueError('workflow revision checks require a Git repository')
    toplevel = Path(result.stdout.decode('utf-8', 'surrogateescape').rstrip('\n')).resolve()
    if toplevel != Path(root).resolve():
        raise ValueError('workflow root is not the top level of its Git repository')


def head(root):
    require_repository(root)
    result = _git(root, 'rev-parse', '--verify', 'HEAD^{commit}')
    if result.returncode:
        raise ValueError('candidate revision unavailable: repository has no commits')
    return result.stdout.decode('ascii').strip()


def require_commit(root, value, field):
    """Return value only if it is a full object id naming a commit in this repository."""
    if not isinstance(value, str) or not OBJECT_ID.match(value):
        raise ValueError(field + ' must be a full Git object id')
    require_repository(root)
    if _git(root, 'cat-file', '-e', value + '^{commit}').returncode:
        raise ValueError('{} is not a commit in this repository: {}'.format(field, value))
    return value


def is_ancestor(root, ancestor, descendant):
    return _git(root, 'merge-base', '--is-ancestor', ancestor, descendant).returncode == 0


def require_ancestor(root, ancestor, descendant, field):
    if not is_ancestor(root, ancestor, descendant):
        raise ValueError('{} is not an ancestor of candidate {}'.format(field, descendant))


def candidate_paths_dirty(root):
    """List changed or untracked non-state paths; ignored files do not count."""
    result = _git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames')
    if result.returncode:
        raise ValueError('cannot read working tree state')
    dirty = []
    for entry in result.stdout.decode('utf-8', 'surrogateescape').split('\0'):
        path = entry[3:]
        if path and not any(path == state or (state.endswith('/') and path.startswith(state))
                            for state in STATE_PATHS):
            dirty.append(path)
    return dirty


def tree_entry(root, revision, relative):
    """Return (mode, kind, object_id) of a path at revision, or None when absent."""
    listing = _git(root, 'ls-tree', '-z', revision, '--', relative)
    if listing.returncode:
        raise ValueError('cannot inspect {} at {}'.format(relative, revision))
    entries = [item for item in listing.stdout.split(b'\0') if item]
    if not entries:
        return None
    metadata, name = entries[0].split(b'\t', 1)
    if len(entries) != 1 or name.decode('utf-8', 'surrogateescape') != relative.rstrip('/'):
        raise ValueError('ambiguous tree entry for {} at {}'.format(relative, revision))
    mode, kind, object_id = metadata.decode('ascii').split()
    return mode, kind, object_id


def optional_blob_at(root, revision, relative, label='file'):
    """Bytes of a regular file at revision, None when absent; symlinks fail closed."""
    entry = tree_entry(root, revision, relative)
    if entry is None:
        return None
    mode, kind, object_id = entry
    if kind != 'blob' or mode not in ('100644', '100755'):
        raise ValueError('{} is not a regular file at {}: {}'.format(label, revision, relative))
    content = _git(root, 'cat-file', 'blob', object_id)
    if content.returncode:
        raise ValueError('cannot read {} at {}'.format(relative, revision))
    return content.stdout


def worktree_clean(root):
    """True when tracked and untracked files all match HEAD (ignored files excepted)."""
    result = _git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
    if result.returncode:
        raise ValueError('cannot read working tree state')
    return result.stdout == b''


def regular_blob_at(root, revision, relative, label='evidence source'):
    """Return bytes of a regular file at revision; symlinks and absences fail closed."""
    content = optional_blob_at(root, revision, relative, label)
    if content is None:
        raise ValueError('{} is not in candidate revision: {}'.format(label, relative))
    return content


def path_history(root, relative):
    """Commits reachable from HEAD that touched a path (newest first); [] without HEAD."""
    require_repository(root)
    if _git(root, 'rev-parse', '--verify', '-q', 'HEAD^{commit}').returncode:
        return []
    result = _git(root, 'log', '--format=%H', '--no-renames', 'HEAD', '--', relative)
    if result.returncode:
        raise ValueError('cannot read history of ' + relative)
    return result.stdout.decode('ascii').split()


def paths_in_history(root, directory):
    """Every path under directory that any commit reachable from HEAD touched."""
    require_repository(root)
    if _git(root, 'rev-parse', '--verify', '-q', 'HEAD^{commit}').returncode:
        return set()
    result = _git(root, 'log', '--format=', '--name-only', '-z', '--no-renames', 'HEAD', '--', directory)
    if result.returncode:
        raise ValueError('cannot read history of ' + directory)
    return {item.strip('\n') for item in result.stdout.decode('utf-8', 'surrogateescape').split('\0')
            if item.strip('\n')}


def historical_versions(root, relative):
    """Yield (commit, bytes) for every version of a path reachable from HEAD."""
    commits = path_history(root, relative)
    if not commits:
        return []
    request = ''.join('{}:{}\n'.format(commit, relative) for commit in commits).encode('utf-8')
    environment = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    result = subprocess.run(['git', '-C', str(root), 'cat-file', '--batch'], input=request,
                            env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ValueError('cannot read history of ' + relative)
    versions, data, position = [], result.stdout, 0
    for commit in commits:
        end = data.index(b'\n', position)
        header = data[position:end].split()
        position = end + 1
        if len(header) == 3 and header[1] == b'blob':
            size = int(header[2])
            versions.append((commit, data[position:position + size]))
            position += size + 1
    return versions


def changed_paths(root, base, candidate):
    """Paths that differ between two commits, without renames, drivers, or textconv."""
    result = _git(root, 'diff', '--name-only', '-z', '--no-renames', '--no-ext-diff',
                  '--no-textconv', base, candidate, '--')
    if result.returncode:
        raise ValueError('cannot compare {} with {}'.format(base, candidate))
    return [item for item in result.stdout.decode('utf-8', 'surrogateescape').split('\0') if item]


def only_state_paths(paths):
    return all(any(path == state or (state.endswith('/') and path.startswith(state))
                   for state in STATE_PATHS) for path in paths)


def merge_base(root, first, second):
    result = _git(root, 'merge-base', first, second)
    if result.returncode:
        raise ValueError('no common history between {} and {}'.format(first, second))
    return result.stdout.decode('ascii').strip()
