"""Symlink-refusing access to workflow state files below a repository root.

Every path component is opened relative to a directory descriptor with
O_NOFOLLOW. A symlinked parent (for example ``progress/work -> /elsewhere``) or
a symlinked state file therefore cannot redirect a read, write, rename, unlink,
or lock outside the repository, even if it is swapped in after a check.
"""
import contextlib
import errno
import fcntl
import os
from pathlib import Path, PurePosixPath
import stat
import threading
import time

DIRECTORY_FLAGS = os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0) | os.O_NOFOLLOW
LOCK_NAME = 'progress/work/.workflow.lock'
LOCK_TIMEOUT_SECONDS = 30.0
_HELD = threading.local()


class StateConflict(ValueError):
    """A state file changed after it was read for validation."""


def _parts(relative):
    path = PurePosixPath(relative)
    if path.is_absolute() or not path.parts or any(part in ('', '.', '..') for part in path.parts):
        raise ValueError('workflow state path must be a plain relative path: ' + str(relative))
    return path.parts


def _redirected(error, label):
    if error.errno in (errno.ELOOP, errno.ENOTDIR, errno.EMLINK):
        return ValueError('{} must not be a symlink or non-directory'.format(label))
    return error


def _open_directory(root, parts, create):
    descriptor = os.open(str(Path(root).resolve()), DIRECTORY_FLAGS)
    walked = []
    try:
        for name in parts:
            walked.append(name)
            label = '/'.join(walked)
            try:
                child = os.open(name, DIRECTORY_FLAGS, dir_fd=descriptor)
            except FileNotFoundError:
                if not create:
                    raise
                try:
                    os.mkdir(name, 0o755, dir_fd=descriptor)
                except FileExistsError:
                    pass
                try:
                    child = os.open(name, DIRECTORY_FLAGS, dir_fd=descriptor)
                except OSError as error:
                    raise _redirected(error, label)
            except OSError as error:
                raise _redirected(error, label)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


@contextlib.contextmanager
def _directory_of(root, relative, create=False):
    parts = _parts(relative)
    descriptor = _open_directory(root, parts[:-1], create)
    try:
        yield descriptor, parts[-1]
    finally:
        os.close(descriptor)


def _kind(descriptor, name):
    try:
        mode = os.stat(name, dir_fd=descriptor, follow_symlinks=False).st_mode
    except FileNotFoundError:
        return None, None
    return mode, ('symlink' if stat.S_ISLNK(mode) else 'file' if stat.S_ISREG(mode) else 'other')


def read_bytes(root, relative):
    """Return the bytes of a regular state file, or None when it is absent."""
    try:
        with _directory_of(root, relative) as (descriptor, name):
            try:
                handle = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                 dir_fd=descriptor)
            except FileNotFoundError:
                return None
            except OSError as error:
                raise _redirected(error, relative)
            with os.fdopen(handle, 'rb') as stream:
                if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                    raise ValueError(relative + ' must be a regular file')
                return stream.read()
    except FileNotFoundError:
        return None


def read_text(root, relative):
    content = read_bytes(root, relative)
    return None if content is None else content.decode('utf-8')


def exists(root, relative):
    """True if anything, including a symlink, occupies the path."""
    try:
        with _directory_of(root, relative) as (descriptor, name):
            return _kind(descriptor, name)[1] is not None
    except FileNotFoundError:
        return False


def write_text(root, relative, text):
    """Atomically replace a state file through a same-directory temporary file."""
    with _directory_of(root, relative, create=True) as (descriptor, name):
        mode, kind = _kind(descriptor, name)
        if kind not in (None, 'file'):
            raise ValueError(relative + ' must be a regular file, not a ' + kind)
        temporary = '.{}.{}.tmp'.format(name, os.urandom(6).hex())
        handle = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=descriptor)
        try:
            with os.fdopen(handle, 'w', encoding='utf-8') as stream:
                stream.write(text)
                stream.flush()
                os.fchmod(stream.fileno(), stat.S_IMODE(mode) if mode is not None else 0o644)
                os.fsync(stream.fileno())
            os.rename(temporary, name, src_dir_fd=descriptor, dst_dir_fd=descriptor)
            os.fsync(descriptor)
        except BaseException:
            try:
                os.unlink(temporary, dir_fd=descriptor)
            except OSError:
                pass
            raise


def write_if_unchanged(root, relative, expected, text):
    """Compare-and-swap: write only if the file still holds `expected` (None = absent)."""
    if read_text(root, relative) != expected:
        raise StateConflict('{} changed since it was read; nothing was written, rerun the '
                            'command'.format(relative))
    write_text(root, relative, text)


def create_exclusive(root, relative, text):
    with _directory_of(root, relative, create=True) as (descriptor, name):
        handle = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644,
                         dir_fd=descriptor)
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.fsync(descriptor)


def unlink(root, relative):
    with _directory_of(root, relative) as (descriptor, name):
        os.unlink(name, dir_fd=descriptor)
        os.fsync(descriptor)


def list_directory(root, relative):
    """Return [(name, kind)] for a state directory; [] when it does not exist."""
    try:
        descriptor = _open_directory(root, _parts(relative), False)
    except FileNotFoundError:
        return []
    try:
        return sorted((name, _kind(descriptor, name)[1]) for name in os.listdir(descriptor))
    finally:
        os.close(descriptor)


def _held():
    if not hasattr(_HELD, 'roots'):
        _HELD.roots = {}
    return _HELD.roots


@contextlib.contextmanager
def workflow_lock(root, timeout=None):
    """Serialize every workflow read-validate-write sequence in this working tree.

    Re-entrant within one thread; other threads and processes wait, then fail.
    """
    key = str(Path(root).resolve())
    held = _held()
    if held.get(key):
        held[key] += 1
        try:
            yield
        finally:
            held[key] -= 1
        return
    with _directory_of(root, LOCK_NAME, create=True) as (descriptor, name):
        handle = os.open(name, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o644, dir_fd=descriptor)
    try:
        deadline = time.monotonic() + (LOCK_TIMEOUT_SECONDS if timeout is None else timeout)
        while True:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise ValueError('another workflow command holds {}; retry when it '
                                     'finishes'.format(LOCK_NAME))
                time.sleep(0.05)
        held[key] = 1
        try:
            yield
        finally:
            held.pop(key, None)
            fcntl.flock(handle, fcntl.LOCK_UN)
    finally:
        os.close(handle)
