# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
auto_scaffold_content() {
    # Auto-create steering/ and hooks/ from agentic.json templates on first render.
    # Uses project_detect rules to decide which scaffolds to auto-promote.
    # Does NOT overwrite existing files.
    local manifest="$ROOT_DIR/.agents/agentic.json"
    [ -f "$manifest" ] || return 0

    # Detect project stack for intelligent scaffolding
    local stack_labels
    stack_labels=$(python3 "$RENDERER" --detect-stack --root "$ROOT_DIR" 2>/dev/null | python3 -c "import json,sys; print(','.join(json.load(sys.stdin)))" 2>/dev/null || echo "")

    # --- Steering ---
    local n_active_steer
    n_active_steer=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('steering',[])))" 2>/dev/null || echo "0")
    if [ "${n_active_steer:-0}" -eq 0 ] && [ -d "$ADAPTERS_DIR" ]; then
        local n_steer_scaffolds
        n_steer_scaffolds=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('_template_steering_examples',[])))" 2>/dev/null || echo "0")
        if [ "${n_steer_scaffolds:-0}" -gt 0 ]; then
            mkdir -p "$ROOT_DIR/steering"
            python3 -c "
import json, os
manifest_path = '$manifest'
stack = set('$stack_labels'.split(',')) if '$stack_labels' else set()
with open(manifest_path) as f:
    m = json.load(f)
steering_dir = '$ROOT_DIR/steering'
created = []
for ex in m.get('_template_steering_examples', []):
    name = ex.get('name', '')
    applies = set(ex.get('applies_to', ['*']))
    # Always promote global steering (*). For per-agent steering, check if the
    # target agent's stack labels overlap with the detected stack or if the named
    # sub-agent would match via applies_when.
    should_promote = '*' in applies
    if not should_promote:
        for agent_name in applies:
            for sa in m.get('subagents', []):
                if sa.get('name') == agent_name:
                    should_promote = True
                    break
    if not should_promote:
        continue
    fname = os.path.basename(ex['file'])
    fpath = os.path.join(steering_dir, fname)
    if not os.path.exists(fpath):
        desc = ex.get('description', '')
        app_list = '\n  - '.join(sorted(applies))
        with open(fpath, 'w') as sf:
            sf.write(f'''---
name: {name}
description: \"{desc}\"
applies_to:
  - {app_list}
---

# {name}

<!-- TODO: customize this steering file for the project -->
''')
        created.append(fname)
if created:
    print(f'Created missing steering examples: {\", \".join(created)}')
" 2>/dev/null
        fi
    fi

    # --- Hooks ---
    local n_active_hooks
    n_active_hooks=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('hooks',[])))" 2>/dev/null || echo "0")
    if [ "${n_active_hooks:-0}" -eq 0 ] && [ -d "$ADAPTERS_DIR" ]; then
        local n_hook_scaffolds
        n_hook_scaffolds=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('_template_hooks_examples',[])))" 2>/dev/null || echo "0")
        if [ "${n_hook_scaffolds:-0}" -gt 0 ]; then
            mkdir -p "$ROOT_DIR/hooks"
            if [ ! -f "$ROOT_DIR/hooks/run-hooks.sh" ]; then
                # One source for the runner: the canonical copy in .agents/lib.
                cp "$BOOTSTRAP_LIB/hook-runner.sh" "$ROOT_DIR/hooks/run-hooks.sh" || return 1
                chmod +x "$ROOT_DIR/hooks/run-hooks.sh"
                echo "Auto-created hooks/run-hooks.sh"
            fi
            python3 -c "
import json, os
manifest_path = '$manifest'
with open(manifest_path) as f:
    m = json.load(f)
hooks_dir = '$ROOT_DIR/hooks'
created = []
for ex in m.get('_template_hooks_examples', []):
    fname = os.path.basename(ex['script'])
    fpath = os.path.join(hooks_dir, fname)
    if not os.path.exists(fpath):
        desc = ex.get('description', '')
        event = ex.get('event', '?')
        with open(fpath, 'w') as sf:
            sf.write(f'''#!/bin/bash
# Hook: {event} — {desc}
echo \"Hook {event} triggered (feature=\${FEATURE_ID:-?} \${FEATURE_NAME:-?})\"
''')
        os.chmod(fpath, 0o755)
        created.append(fname)
if created:
    print(f'Created missing hook examples: {\", \".join(created)}')
" 2>/dev/null
        fi
    fi
}

