# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
list_steering() {
    python3 -c "
import json
m = json.load(open('$ROOT_DIR/.agents/agentic.json'))
for s in m.get('steering', []):
    print(f'{s[\"name\"]}  file={s[\"file\"]}  applies_to={s.get(\"applies_to\",[\"*\"])}  {s.get(\"description\",\"\")}')
if not m.get('steering'):
    print('(no steering files active)')
"
}

add_steering_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local name=""
    local description=""
    local applies_to="*"

    while [ "${1:-}" != "" ]; do
        case "$1" in
            --description) description="$2"; shift 2 ;;
            --applies-to)  applies_to="$2"; shift 2 ;;
            --yes|-y) ;;
            -*)
                echo "ERROR: unknown add-steering option: $1" >&2
                echo "Usage: ./.agents/bootstrap.sh add-steering <name> --description '...' [--applies-to 'agent1,agent2']" >&2
                return 1
                ;;
            *)
                if [ -z "$name" ]; then
                    name="$1"
                else
                    echo "ERROR: unexpected positional argument: $1" >&2
                    return 1
                fi
                ;;
        esac
        shift
    done

    if [ -z "$name" ]; then
        echo "Usage: ./.agents/bootstrap.sh add-steering <name> --description '...' [--applies-to 'agent1,agent2']" >&2
        echo ""
        echo "Current steering files:"
        list_steering | sed 's/^/  /'
        return 1
    fi

    local file="steering/${name}.md"

    # Create steering/ directory if missing
    mkdir -p "$ROOT_DIR/steering"

    # Create steering file from template if it doesn't exist
    if [ ! -f "$ROOT_DIR/$file" ]; then
        local template="$ROOT_DIR/specs/templates/steering.md"
        if [ -f "$template" ]; then
            cp "$template" "$ROOT_DIR/$file"
        else
            # Minimal fallback template
            cat > "$ROOT_DIR/$file" <<EOF
---
name: ${name}
description: "${description}"
applies_to:
  - ${applies_to//,/", "}
---

# ${name}

## Contexto

<!-- TODO: describir el contexto -->

## Reglas

1. <!-- TODO: regla 1 -->

## Anti-patrones

- <!-- TODO: anti-patrón 1 -->
EOF
        fi
        echo "Created $file"
    else
        echo "Steering file already exists: $file (reusing)"
    fi

    # Add entry to agentic.json
    python3 -c "
import json, sys
manifest_path = '$ROOT_DIR/.agents/agentic.json'
with open(manifest_path) as f:
    m = json.load(f)
name = '$name'
# Remove if already exists (update)
m['steering'] = [h for h in m.get('steering', []) if h.get('name') != name]
# Parse applies_to list
applies_raw = '$applies_to'
applies_list = [a.strip() for a in applies_raw.split(',') if a.strip()]
m['steering'].append({
    'name': name,
    'file': '$file',
    'description': '$description',
    'applies_to': applies_list,
})
with open(manifest_path, 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f'Added steering entry: {name}')
"

    echo ""
    echo "Re-rendering adapters for all CLIs..."
    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
    echo "Done."
}

remove_steering_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local name="${1:-}"
    if [ -z "$name" ]; then
        echo "Usage: ./.agents/bootstrap.sh remove-steering <name>" >&2
        echo ""
        echo "Current steering files:"
        list_steering | sed 's/^/  /'
        return 1
    fi

    python3 -c "
import json, sys
manifest_path = '$ROOT_DIR/.agents/agentic.json'
with open(manifest_path) as f:
    m = json.load(f)
name = '$name'
before = len(m.get('steering', []))
m['steering'] = [h for h in m.get('steering', []) if h.get('name') != name]
after = len(m['steering'])
with open(manifest_path, 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write('\n')
if before == after:
    print(f'Steering entry \"{name}\" not found in agentic.json (no change)')
else:
    print(f'Removed steering entry: {name} (file on disk NOT deleted)')
"

    echo ""
    echo "Re-rendering adapters for all CLIs..."
    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
    echo "Done."
}

list_hooks() {
    python3 -c "
import json
m = json.load(open('$ROOT_DIR/.agents/agentic.json'))
for h in m.get('hooks', []):
    print(f'{h[\"event\"]:<28} script={h[\"script\"]}  on_failure={h.get(\"on_failure\",\"warn\")}  {h.get(\"description\",\"\")}')
if not m.get('hooks'):
    print('(no hooks registered)')
"
}

add_hook_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local event=""
    local script=""
    local description=""
    local on_failure="warn"

    while [ "${1:-}" != "" ]; do
        case "$1" in
            --event)        event="$2"; shift 2 ;;
            --script)       script="$2"; shift 2 ;;
            --description)  description="$2"; shift 2 ;;
            --on-failure)   on_failure="$2"; shift 2 ;;
            --yes|-y) ;;
            -*)
                echo "ERROR: unknown add-hook option: $1" >&2
                echo "Usage: ./.agents/bootstrap.sh add-hook --event <event> --script <path> [--description '...'] [--on-failure warn|error|ignore]" >&2
                return 1
                ;;
            *)
                echo "ERROR: unexpected positional argument: $1" >&2
                return 1
                ;;
        esac
        shift
    done

    if [ -z "$event" ] || [ -z "$script" ]; then
        echo "Usage: ./.agents/bootstrap.sh add-hook --event <event> --script <path> [--description '...'] [--on-failure warn|error|ignore]" >&2
        echo ""
        echo "Known events: on_spec_created, on_spec_approved, on_implementation_start, on_implementation_complete, on_review_start, on_review_complete, on_feature_done, on_check_pass"
        echo ""
        echo "Current hooks:"
        list_hooks | sed 's/^/  /'
        return 1
    fi

    if [ -z "$description" ]; then
        description="Hook for event: $event"
    fi

    # Create script if it doesn't exist
    if [ ! -f "$ROOT_DIR/$script" ]; then
        mkdir -p "$(dirname "$ROOT_DIR/$script")"
        cat > "$ROOT_DIR/$script" <<EOF
#!/bin/bash
# Hook: $event — $description
echo "Hook $event triggered"
echo "Feature: \${FEATURE_ID:-\?} — \${FEATURE_NAME:-\?}"
# TODO: customize this hook
EOF
        chmod +x "$ROOT_DIR/$script"
        echo "Created $script (+x)"
    else
        echo "Script already exists: $script (reusing)"
    fi

    # Add entry to agentic.json
    python3 -c "
import json
manifest_path = '$ROOT_DIR/.agents/agentic.json'
with open(manifest_path) as f:
    m = json.load(f)
# Remove existing entry for same event+script (update)
m['hooks'] = [h for h in m.get('hooks', []) if not (h.get('event') == '$event' and h.get('script') == '$script')]
m['hooks'].append({
    'event': '$event',
    'script': '$script',
    'description': '$description',
    'on_failure': '$on_failure',
})
with open(manifest_path, 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f'Added hook: {event} -> {script}')
"

    echo ""
    echo "Re-rendering adapters for all CLIs..."
    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
    echo "Done."
}

remove_hook_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local event=""
    local script=""

    while [ "${1:-}" != "" ]; do
        case "$1" in
            --event)   event="$2"; shift 2 ;;
            --script)  script="$2"; shift 2 ;;
            --yes|-y)  ;;
            -*)
                echo "ERROR: unknown remove-hook option: $1" >&2
                echo "Usage: ./.agents/bootstrap.sh remove-hook --event <event> --script <path>" >&2
                return 1
                ;;
            *)
                echo "ERROR: unexpected positional argument: $1" >&2
                return 1
                ;;
        esac
        shift
    done

    if [ -z "$event" ] || [ -z "$script" ]; then
        echo "Usage: ./.agents/bootstrap.sh remove-hook --event <event> --script <path>" >&2
        echo ""
        echo "Current hooks:"
        list_hooks | sed 's/^/  /'
        return 1
    fi

    python3 -c "
import json
manifest_path = '$ROOT_DIR/.agents/agentic.json'
with open(manifest_path) as f:
    m = json.load(f)
before = len(m.get('hooks', []))
m['hooks'] = [h for h in m.get('hooks', []) if not (h.get('event') == '$event' and h.get('script') == '$script')]
after = len(m['hooks'])
with open(manifest_path, 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write('\n')
if before == after:
    print(f'Hook ({event}=\"$event\", script=\"$script\") not found in agentic.json (no change)')
else:
    print(f'Removed hook: {event}=$event script=$script (file on disk NOT deleted)')
"

    echo ""
    echo "Re-rendering adapters for all CLIs..."
    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
    echo "Done."
}

