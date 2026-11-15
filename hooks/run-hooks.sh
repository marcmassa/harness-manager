#!/bin/bash
# Runs the lifecycle hooks registered in .agents/agentic.json for one event.
#
# Canonical source: .agents/lib/hook-runner.sh. It is installed, byte for byte,
# as hooks/run-hooks.sh, and it runs from there (ROOT_DIR is its parent's parent).
#
#   hooks/run-hooks.sh <event> [--feature-id ID] [--feature-name NAME] [--agent-name NAME]
#
# Fails closed: an unreadable manifest, a script outside the repository, a
# missing or non-executable script, and a timeout all count as a hook failure
# and follow that hook's on_failure policy (error | warn | ignore).
# Timeout: hook "timeout_seconds", else $HOOK_TIMEOUT_SECONDS, else 300.
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EVENT="${1:-}"; shift 2>/dev/null || true
export ROOT_DIR HOOK_EVENT="$EVENT"
while [ $# -gt 0 ]; do
    case "$1" in
        --feature-id) export FEATURE_ID="${2:-}"; shift 2 2>/dev/null || shift ;;
        --feature-name) export FEATURE_NAME="${2:-}"; shift 2 2>/dev/null || shift ;;
        --agent-name) export AGENT_NAME="${2:-}"; shift 2 2>/dev/null || shift ;;
        *) shift ;;
    esac
done
[ -z "$EVENT" ] && { echo "ERROR: event required" >&2; exit 1; }
# The event and root travel as arguments, never as program text.
exec python3 - "$ROOT_DIR" "$EVENT" <<'PY'
import json
import os
import re
import signal
import subprocess
import sys

root = os.path.realpath(sys.argv[1])
event = sys.argv[2]


def say(text):
    print(text, flush=True)


def stop(text):
    print('ERROR: ' + text, file=sys.stderr, flush=True)
    sys.exit(1)


if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', event):
    stop('invalid hook event name')
manifest = os.path.join(root, '.agents', 'agentic.json')
if not os.path.isfile(manifest):
    say('No manifest — skipping hooks')
    sys.exit(0)
try:
    with open(manifest, encoding='utf-8') as stream:
        hooks = json.load(stream).get('hooks', [])
except (OSError, ValueError, AttributeError) as error:
    stop('cannot read hooks from .agents/agentic.json: {}'.format(error))
if not isinstance(hooks, list) or not all(isinstance(hook, dict) for hook in hooks):
    stop('.agents/agentic.json hooks must be an array of objects')
selected = [hook for hook in hooks if hook.get('event') == event]
if not selected:
    say('No hooks for: ' + event)
    sys.exit(0)


def resolve(script):
    """Return (path, None) for an executable file inside the repository, else (None, reason)."""
    if not isinstance(script, str) or not script.strip():
        return None, 'no script declared'
    if os.path.isabs(script) or '..' in script.replace('\\', '/').split('/'):
        return None, 'script must be a relative path inside the repository'
    path = os.path.realpath(os.path.join(root, script))
    if not path.startswith(root + os.sep):
        return None, 'script resolves outside the repository'
    if not os.path.isfile(path):
        return None, 'script not found'
    if not os.access(path, os.X_OK):
        return None, 'script is not executable'
    return path, None


def limit(hook):
    for value in (hook.get('timeout_seconds'), os.environ.get('HOOK_TIMEOUT_SECONDS')):
        try:
            seconds = float(value)
        except (TypeError, ValueError):
            continue
        if seconds > 0:
            return seconds
    return 300.0


def run(path, seconds):
    process = subprocess.Popen(['bash', path], stdin=subprocess.DEVNULL, start_new_session=True)
    try:
        return process.wait(timeout=seconds), None
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except OSError:
            process.kill()
        process.wait()
        return 124, 'timed out after {:g}s'.format(seconds)


say('Running hooks for: ' + event)
overall = 0
for hook in selected:
    script = hook.get('script')
    policy = hook.get('on_failure', 'warn')
    say('  -- {} — {}'.format(script, hook.get('description', '')))
    path, problem = resolve(script)
    code = 1
    if path is not None:
        code, problem = run(path, limit(hook))
    if code == 0:
        say('  PASSED')
        continue
    detail = ': ' + problem if problem else ''
    if policy == 'ignore':
        say('  FAILED (ignored)' + detail)
    elif policy == 'warn':
        say('  FAILED (warn)' + detail)
        overall = 1
    else:
        # 'error', and any unknown policy, stops here.
        say('  FAILED (aborting)' + detail)
        sys.exit(code if 0 < code < 256 else 1)
sys.exit(overall)
PY
