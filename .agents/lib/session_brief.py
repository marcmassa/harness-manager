#!/usr/bin/env python3
"""Compact session brief and context-budget tools; standard library only.

`brief` prints what an agent needs at session start in about one kilobyte, so
it does not read feature_list.json, tasks.md, or progress logs in full. Those
files grow with the project; the brief does not. `archive` moves an oversized
progress log out of the session path. The brief is read-only.
"""
import argparse
import datetime
import json
from pathlib import Path
import re
import sys

ORDER = ('in_progress', 'spec_ready', 'blocked', 'pending', 'done')
TASK = re.compile(r'^\s*(?:>\s?)*(?:[-*+]|\d+[.)])?\s*\[(.?)\]\s*(?:\*\*|__)?(T\d+(?:\.\d+)*)(?:\*\*|__)?'
                  r'\s*(?:[:—–-]\s*)?(.*)$')
CURRENT = 'progress/current.md'
SPEC_BASES = ('specs', '.kiro/specs')
CURRENT_SHOWN = 2000
# Bytes. Files an agent loads every session stay small; logs are read by tail only.
BUDGETS = {'AGENTS.md': 8000, CURRENT: 3000, 'progress/handoff.md': 8000,
           # Logs share the staged-file limit of .githooks, so the warning comes before the block.
           'progress/progress.md': 20000, 'progress/history.md': 20000,
           'progress/decisions.md': 20000}
SESSION_FILES = ('AGENTS.md', CURRENT, 'progress/handoff.md')


def _read(path):
    try:
        return path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None


def _json(path):
    text = _read(path)
    if text is None:
        return None
    try:
        return json.loads(text)
    except ValueError:
        raise ValueError('{} is not valid JSON'.format(path.name))


def _short(text, limit=110):
    text = ' '.join(str(text or '').split())
    return text if len(text) <= limit else text[:limit - 1].rstrip() + '…'


def _label(feature):
    return '{} {}'.format(feature.get('id', '?'), feature.get('name', '?'))


def task_progress(tasks_text):
    """Return (done, total, next_task_line) from tasks.md, tolerating any layout."""
    done = total = 0
    upcoming = None
    for line in tasks_text.splitlines():
        match = TASK.match(line)
        if not match:
            continue
        total += 1
        if match.group(1) in ('x', 'X'):
            done += 1
        elif upcoming is None:
            upcoming = '{} — {}'.format(match.group(2), _short(match.group(3), 90))
    return done, total, upcoming


def _features(root):
    data = _json(root / 'feature_list.json')
    if data is None:
        return None
    features = data.get('features') if isinstance(data, dict) else None
    if not isinstance(features, list):
        raise ValueError('feature_list.json has no features array')
    return [item for item in features if isinstance(item, dict)]


def _counts(features):
    counts = {}
    for feature in features:
        status = str(feature.get('status'))
        counts[status] = counts.get(status, 0) + 1
    ordered = [name for name in ORDER if name in counts] + sorted(set(counts) - set(ORDER))
    return ', '.join('{} {}'.format(name, counts[name]) for name in ordered)


def _active_lines(root, feature):
    lines = ['active: {} [{}{}] — {}'.format(
        _label(feature), feature.get('status'), '' if feature.get('sdd') is False else ', sdd',
        _short(feature.get('title') or feature.get('description'), 90))]
    spec = 'specs/{}'.format(feature.get('name'))
    for base in SPEC_BASES:  # first layout that holds this feature's tasks
        if (root / base / str(feature.get('name')) / 'tasks.md').is_file():
            spec = '{}/{}'.format(base, feature.get('name'))
            break
    tasks = _read(root / spec / 'tasks.md')
    if tasks is None:
        if feature.get('sdd') is not False:
            lines.append('  spec: {}/ has no tasks.md'.format(spec))
        return lines
    done, total, upcoming = task_progress(tasks)
    detail = '  spec: {}/ · tasks {}/{}'.format(spec, done, total)
    lines.append(detail + (' · next: ' + upcoming if upcoming else ' · all tasks checked'))
    if feature.get('pending_hook'):
        lines.append('  failed lifecycle hook pending: run workflow-recover before continuing')
    return lines


def _init_state(root):
    manifest = _json(root / '.agents/agentic.json')
    if not isinstance(manifest, dict):
        return 'manifest: .agents/agentic.json is missing'
    scaffolds = any(manifest.get(key) for key in ('_template_subagents_examples',
                                                   '_template_steering_examples',
                                                   '_template_hooks_examples'))
    if not manifest.get('subagents'):
        return 'init: FRESH — run /init before feature work' if scaffolds else None
    return 'init: PARTIAL — scaffolds remain, finish /init' if scaffolds else None


def budget_warnings(root):
    manifest = _json(root / '.agents/agentic.json')
    budgets = dict(BUDGETS)
    extra = manifest.get('context_budget') if isinstance(manifest, dict) else None
    if isinstance(extra, dict):
        budgets.update({key: value for key, value in extra.items()
                        if isinstance(value, int) and not isinstance(value, bool) and value > 0})
    warnings = []
    for relative in sorted(budgets):
        path = root / relative
        if not path.is_file():
            continue
        size = path.stat().st_size
        if size <= budgets[relative]:
            continue
        if relative.startswith('progress/') and relative != CURRENT:
            action = './.agents/bootstrap.sh archive-log ' + relative
        elif relative == CURRENT:
            action = 'keep only the live state; move the rest to progress/history.md'
        else:
            action = 'move detail into docs/ and link it'
        cost = 'loaded every session' if relative in SESSION_FILES else 'read its tail only'
        warnings.append('  {} is {:.1f} KB (budget {:.0f} KB, {}): {}'.format(
            relative, size / 1000.0, budgets[relative] / 1000.0, cost, action))
    return warnings


def brief(root):
    root = Path(root).resolve()
    lines = ['Harness SDD brief']
    features = _features(root)
    if features is None:
        lines.append('features: feature_list.json not found')
        features = []
    else:
        lines.append('features: {} — {}'.format(len(features), _counts(features) or 'none'))
    by_status = {}
    for feature in features:
        by_status.setdefault(feature.get('status'), []).append(feature)
    for feature in by_status.get('in_progress', []):
        lines.extend(_active_lines(root, feature))
    if not by_status.get('in_progress'):
        lines.append('active: none')
    for status, title in (('spec_ready', 'awaiting human approval'), ('blocked', 'blocked')):
        if by_status.get(status):
            lines.append('{}: {}'.format(title, ', '.join(_label(f) for f in by_status[status][:8])))
    pending = by_status.get('pending', [])
    if pending:
        more = ' (+{} more)'.format(len(pending) - 3) if len(pending) > 3 else ''
        lines.append('next pending: ' + ', '.join(_label(f) for f in pending[:3]) + more)
    state = _init_state(root)
    if state:
        lines.append(state)
    current = _read(root / CURRENT)
    if current is not None and current.strip():
        lines.append('--- {} ---'.format(CURRENT))
        body = current.strip()
        if len(body) > CURRENT_SHOWN:
            body = body[:CURRENT_SHOWN].rstrip() + '\n[truncated: {} of {} characters shown]'.format(
                CURRENT_SHOWN, len(current.strip()))
        lines.append(body)
    warnings = budget_warnings(root)
    if warnings:
        lines.append('--- context budget exceeded ---')
        lines.extend(warnings)
    return '\n'.join(lines)


def archive(root, relative, today=None):
    """Move a progress log to progress/archive/ and leave a short stub in its place."""
    root = Path(root).resolve()
    parts = Path(relative).parts
    if Path(relative).is_absolute() or '..' in parts or len(parts) != 2 or parts[0] != 'progress' \
            or not relative.endswith('.md'):
        raise ValueError('archive-log takes a Markdown file directly under progress/')
    source = root / relative
    if source.is_symlink() or not source.is_file():
        raise ValueError(relative + ' is not a regular file')
    folder = root / 'progress/archive'
    if folder.is_symlink() or (root / 'progress').is_symlink():
        raise ValueError('progress/archive must not be a symlink')
    folder.mkdir(exist_ok=True)
    stamp = (today or datetime.date.today()).strftime('%Y%m%d')
    target = folder / '{}-{}.md'.format(source.stem, stamp)
    serial = 1
    while target.exists() or target.is_symlink():
        serial += 1
        target = folder / '{}-{}-{}.md'.format(source.stem, stamp, serial)
    text = source.read_text(encoding='utf-8', errors='replace')
    first = text.splitlines()[0] if text.strip() else ''
    heading = first if first.startswith('# ') else '# ' + source.stem
    source.rename(target)
    archived = target.relative_to(root).as_posix()
    source.write_text('{}\n\n> Earlier entries: `{}`. Read them only when history is needed.\n'
                      .format(heading, archived), encoding='utf-8')
    return archived


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    parser.add_argument('--archive', metavar='PROGRESS_FILE')
    args = parser.parse_args(argv)
    try:
        if args.archive:
            print('archived to ' + archive(args.root, args.archive))
        else:
            print(brief(args.root))
    except (ValueError, OSError) as error:
        print('[FAIL] brief: {}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
