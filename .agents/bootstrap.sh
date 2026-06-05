#!/bin/bash
# bootstrap.sh — Generate the native config adapter for your CLI from .agents/agentic.json
#
# Workflow:
#   ./.agents/bootstrap.sh <cli>                 # Render the native config for <cli>
#   ./.agents/bootstrap.sh --all                 # Render for every adapter that exists
#   ./.agents/bootstrap.sh --check               # Re-render to a temp file and diff; exit 1 if drift
#   ./.agents/bootstrap.sh detect                # Detect available CLIs and project stack
#
# Scaffold lifecycle (project shaping):
#   ./.agents/bootstrap.sh init                  # Show /init workflow + current scaffold-lifecycle state
#   ./.agents/bootstrap.sh init --validate       # Objective completion gate (exits 0 if /init is complete)
#   ./.agents/bootstrap.sh profile               # Report: active set + matching template examples
#   ./.agents/bootstrap.sh add-agent <name>      # Promote a template example to the active manifest
#   ./.agents/bootstrap.sh add-agent --all-matched  # Promote all examples that match this project
#   ./.agents/bootstrap.sh remove-examples       # Drop template scaffolds from the manifest (final stage)
#
# Housekeeping:
#   ./.agents/bootstrap.sh --list-adapters       # List adapters in .agents/adapters/
#   ./.agents/bootstrap.sh --list-orphans        # List canonical subagents on disk but missing from agentic.json
#   ./.agents/bootstrap.sh --list-examples       # List template example sub-agents
#   ./.agents/bootstrap.sh prune                 # Delete orphaned canonical subagent directories
#   ./.agents/bootstrap.sh --help                # Show this help

set -uo pipefail

if [ -n "${ROOT_DIR:-}" ]; then
    ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
else
    ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi
RENDERER="$ROOT_DIR/.agents/adapters/_common/render.py"
ADAPTERS_DIR="$ROOT_DIR/.agents/adapters"

print_help() {
    sed -n '2,20p' "$0" | sed 's/^# \?//'
}

list_adapters() {
    echo "Available adapters in $ADAPTERS_DIR:"
    for dir in "$ADAPTERS_DIR"/*/; do
        [ -d "$dir" ] || continue
        name=$(basename "$dir")
        [ "$name" = "_common" ] && continue
        [ "$name" = "_generic" ] && continue
        if ls "$dir"/*.tmpl &>/dev/null; then
            echo "  - $name"
        fi
    done
}

list_examples() {
    python3 "$RENDERER" --list-examples --root "$ROOT_DIR"
}

remove_examples_run() {
    local yes_flag=""
    while [ "${1:-}" != "" ]; do
        case "$1" in
            --yes|-y) yes_flag="1" ;;
            *)
                echo "ERROR: unknown remove-examples option: $1" >&2
                return 1
                ;;
        esac
        shift
    done

    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local n
    n=$(python3 "$RENDERER" --list-examples --root "$ROOT_DIR" 2>/dev/null | wc -l | tr -d ' ')
    if [ "${n:-0}" -eq 0 ]; then
        echo "No template scaffolds to remove — the manifest is already clean."
        return 0
    fi

    echo "This will drop the template scaffolds from .agents/agentic.json:"
    echo "  - _template_subagents_examples[] ($n entries)"
    echo "  - _template_lifecycle"
    echo ""
    echo "The leading-underscore convention guarantees they were never rendered."
    echo "Sub-agents already promoted to subagents[] (via 'add-agent') are NOT affected."
    echo ""

    local confirm="n"
    if [ -n "$yes_flag" ]; then
        confirm="y"
    elif [ -t 0 ]; then
        printf "Remove the template scaffolds? [y/N]: "
        read -r confirm
    fi
    case "$confirm" in
        y|Y|yes|YES)
            echo ""
            python3 "$RENDERER" --remove-examples --root "$ROOT_DIR"
            echo ""
            echo "Re-rendering adapters for all CLIs..."
            ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all >/dev/null
            echo ""
            echo "Done. The manifest now contains only the project's sub-agents."
            ;;
        *)
            echo "Aborted. No changes made."
            ;;
    esac
}

prune_orphans() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi
    python3 "$RENDERER" --prune --root "$ROOT_DIR"
}

list_orphans() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi
    python3 "$RENDERER" --list-orphans --root "$ROOT_DIR"
}

init_show() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local manifest="$ROOT_DIR/.agents/agentic.json"
    if [ ! -f "$manifest" ]; then
        echo "ERROR: manifest not found at $manifest" >&2
        return 1
    fi

    local validate="0"
    while [ "${1:-}" != "" ]; do
        case "$1" in
            --validate) validate="1" ;;
            --yes|-y) ;;
            *)
                echo "ERROR: unknown init option: $1" >&2
                return 1
                ;;
        esac
        shift
    done

    if [ "$validate" = "1" ]; then
        local report
        report=$(python3 "$RENDERER" --validate-init --root "$ROOT_DIR" 2>&1)
        local rc=$?
        echo "=== /init — VALIDATION (objective completion gate) ==="
        echo ""
        echo "$report" | python3 -c "
import json, sys
try:
    data = sys.stdin.read()
    start = data.find('{')
    r = json.loads(data[start:])
    print(f'  State:     {r[\"state\"]}')
    print(f'  Active:    {r.get(\"active_count\", 0)} sub-agent(s)')
    print(f'  Scaffolds: {r.get(\"scaffold_count\", 0)} remaining')
    print(f'  Summary:   {r[\"summary\"]}')
    print()
    if r.get('errors'):
        print(f'  ERRORS ({len(r[\"errors\"])}):')
        for e in r['errors']:
            print(f'    - {e}')
    if r.get('warnings'):
        print(f'  WARNINGS ({len(r[\"warnings\"])}):')
        for w in r['warnings']:
            print(f'    - {w}')
    print()
    if r['ok']:
        print('  RESULT: /init is COMPLETE.')
    else:
        print('  RESULT: /init is NOT complete. Fix the errors above and re-run.')
except Exception as ex:
    print(f'  ERROR parsing validation report: {ex}', file=sys.stderr)
    print(data, file=sys.stderr)
    sys.exit(1)
"
        return $rc
    fi

    local n_active
    n_active=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('subagents', [])))")
    local n_scaffolds
    n_scaffolds=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('_template_subagents_examples', [])))")

    local validate="0"
    while [ "${1:-}" != "" ]; do
        case "$1" in
            --validate) validate="1" ;;
            --yes|-y) ;;
            *)
                echo "ERROR: unknown init option: $1" >&2
                return 1
                ;;
        esac
        shift
    done

    if [ "$validate" = "1" ]; then
        echo "=== /init — VALIDATION (objective completion gate) ==="
        echo ""
        local report
        report=$(python3 "$RENDERER" --validate-init --root "$ROOT_DIR" 2>&1)
        local rc=$?
        echo "$report" | python3 -c "
import json, sys
try:
    data = sys.stdin.read()
    start = data.find('{')
    r = json.loads(data[start:])
    print(f'  State:     {r[\"state\"]}')
    print(f'  Active:    {r.get(\"active_count\", 0)} sub-agent(s)')
    print(f'  Scaffolds: {r.get(\"scaffold_count\", 0)} remaining')
    print(f'  Summary:   {r[\"summary\"]}')
    print()
    if r.get('errors'):
        print(f'  ERRORS ({len(r[\"errors\"])}):')
        for e in r['errors']:
            print(f'    - {e}')
    if r.get('warnings'):
        print(f'  WARNINGS ({len(r[\"warnings\"])}):')
        for w in r['warnings']:
            print(f'    - {w}')
    if r['ok']:
        print()
        print('  RESULT: /init is COMPLETE.')
    else:
        print()
        print('  RESULT: /init is NOT complete. Fix the errors above and re-run.')
except Exception as ex:
    print(f'  ERROR parsing validation report: {ex}', file=sys.stderr)
    print(data, file=sys.stderr)
    sys.exit(1)
"
        return $rc
    fi

    echo "=== /init — scaffold lifecycle status ==="
    echo ""
    if [ "${n_active:-0}" -eq 0 ] && [ "${n_scaffolds:-0}" -gt 0 ]; then
        echo "  State:  FRESH INSTALL — subagents[] is empty, $n_scaffolds scaffolds in _template_subagents_examples[]."
        echo "          The agent should run /init to shape the manifest to this project."
        echo "          Suggested next command: tell the agent \"run /init\"."
    elif [ "${n_active:-0}" -gt 0 ] && [ "${n_scaffolds:-0}" -gt 0 ]; then
        echo "  State:  PARTIAL — subagents[] has $n_active entries (project-specific), $n_scaffolds scaffolds remain."
        echo "          The agent should finish /init by running 'remove-examples' once the project's sub-agents are in place."
    elif [ "${n_active:-0}" -gt 0 ] && [ "${n_scaffolds:-0}" -eq 0 ]; then
        echo "  State:  INITIALIZED — subagents[] has $n_active project-specific entries, no scaffolds remain."
        echo "          The project is shaped. /init is not needed again."
    else
        echo "  State:  EMPTY — subagents[] and _template_subagents_examples[] are both empty."
        echo "          Run ./check.sh to diagnose."
    fi
    echo ""
    echo "  Active sub-agents (subagents[]):"
    if [ "${n_active:-0}" -gt 0 ]; then
        python3 -c "
import json
m = json.load(open('$manifest'))
for a in m.get('subagents', []):
    desc = a.get('description', '')[:60]
    print(f'    - {a[\"name\"]:<24} {desc}')
"
    else
        echo "    (none)"
    fi
    echo ""
    echo "  Scaffold examples (_template_subagents_examples[]):"
    if [ "${n_scaffolds:-0}" -gt 0 ]; then
        python3 -c "
import json
m = json.load(open('$manifest'))
for a in m.get('_template_subagents_examples', []):
    cat = a.get('category', '?')
    intent = a.get('_intent', '').split('.')[0][:60]
    print(f'    - {a[\"name\"]:<24} [{cat}]  {intent}')
"
    else
        echo "    (none)"
    fi
    echo ""
    echo "  Agent workflow (./.agents/commands/init.md):"
    echo "    1. Read the project (README, feature_list.json, layout)."
    echo "    2. Decide which sub-agents the project needs (always the 4 canonicals,"
    echo "       plus any stack-specific illustratives: python, terraform, frontend, data)."
    echo "    3. For each: either ./bootstrap.sh add-agent <name> --yes   (borrow as-is)"
    echo "                or copy the entry to subagents[] and customize (recommended)."
    echo "    4. ./bootstrap.sh remove-examples --yes   (drop the scaffolds)."
    echo "    5. ./bootstrap.sh init --validate         (objective completion gate, must exit 0)."
    echo "    6. ./check.sh                              (must be green)."
    echo ""
    echo "  Tell the agent: \"run /init\"  (or invoke the init slash command directly)."
    echo "  Completion gate: ./bootstrap.sh init --validate   (MUST exit 0 before init is declared done)"
    echo ""
    echo "  Reference: AGENTS.md §0.5 — Project Profiling (3-stage lifecycle)."
}

profile_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local report
    report=$(python3 "$RENDERER" --profile --root "$ROOT_DIR" 2>&1)
    if [ $? -ne 0 ]; then
        echo "$report"
        return 1
    fi

    echo "Project profile (scaffold lifecycle):"
    echo ""
    echo "$report" | python3 -c "
import json, sys
data = sys.stdin.read()
start = data.find('{')
r = json.loads(data[start:])
print(f'  Detected stack: {\", \".join(r[\"detected_stack\"]) or \"(none)\"}')
print('')
print('  STAGE 3 — Final (project-only) state of subagents[]:')
if r['active']:
    for a in r['active']:
        marker = '+' if a['action'] == 'scaffold' else '·'
        print(f'    {marker} {a[\"name\"]:<22} {a[\"reason\"]}')
else:
    print('    (none yet — go to STAGE 2 to populate)')
print('')
print('  STAGE 1 — Scaffolds still in _template_subagents_examples[]:')
n_match = len(r['examples_matching'])
n_idle  = len(r['examples_idle'])
if n_match or n_idle:
    for e in r['examples_matching']:
        print(f'    ~ {e[\"name\"]:<22} {e[\"reason\"]}  -> add-agent {e[\"name\"]}')
    for e in r['examples_idle']:
        if e.get('source') == '_template_subagents_examples':
            print(f'    . {e[\"name\"]:<22} (not relevant for this project)')
    print('')
    print(f'    Total scaffolds: {n_match + n_idle}  (use \"remove-examples\" to drop them all)')
else:
    print('    (none — scaffolds already removed; project-only state)')
print('')
print('  Workflow:')
print('    STAGE 1. Scaffold   — read this profile to see the patterns.')
print('    STAGE 2. Implement  — copy a scaffold into subagents[] and customize it.')
print('                       (or: ./bootstrap.sh add-agent <name>   to borrow as-is)')
print('    STAGE 3. Remove     — ./bootstrap.sh remove-examples     to drop the scaffolds.')
"
}

add_agent_run() {
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi

    local yes_flag=""
    local name=""
    local mode=""
    while [ "${1:-}" != "" ]; do
        case "$1" in
            --yes|-y) yes_flag="1" ;;
            --all-matched|--matched) mode="all-matched" ;;
            -*)
                echo "ERROR: unknown add-agent option: $1" >&2
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

    if [ "$mode" = "all-matched" ]; then
        local matched
        matched=$(python3 "$RENDERER" --profile --root "$ROOT_DIR" 2>&1 | python3 -c "
import json, sys
data = sys.stdin.read()
start = data.find('{')
r = json.loads(data[start:])
print('\n'.join(e['name'] for e in r['examples_matching']))
")
        if [ -z "$matched" ]; then
            echo "No template examples match this project. Nothing to add."
            return 0
        fi
        echo "Promoting all template examples that match this project:"
        echo "$matched" | sed 's/^/  - /'
        echo ""
        local confirm="n"
        if [ -n "$yes_flag" ]; then
            confirm="y"
        elif [ -t 0 ]; then
            printf "Proceed? [y/N]: "
            read -r confirm
        fi
        case "$confirm" in
            y|Y|yes|YES)
                local any_added=0
                while IFS= read -r n; do
                    [ -z "$n" ] && continue
                    echo ""
                    python3 "$RENDERER" --add-agent "$n" --root "$ROOT_DIR"
                    any_added=1
                done <<< "$matched"
                if [ "$any_added" -eq 1 ]; then
                    echo ""
                    echo "Re-rendering adapters for all CLIs..."
                    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all >/dev/null
                fi
                ;;
            *)
                echo "Aborted. No changes made."
                return 0
                ;;
        esac
        return 0
    fi

    if [ -z "$name" ]; then
        echo "Usage: ./.agents/bootstrap.sh add-agent <name> [--yes] | --all-matched [--yes]" >&2
        echo ""
        echo "Available template examples:"
        list_examples | sed 's/^/  - /'
        return 1
    fi

    local confirm="n"
    if [ -n "$yes_flag" ]; then
        confirm="y"
    elif [ -t 0 ]; then
        printf "Promote '%s' from _template_subagents_examples to subagents[]? [y/N]: " "$name"
        read -r confirm
    fi
    case "$confirm" in
        y|Y|yes|YES)
            python3 "$RENDERER" --add-agent "$name" --root "$ROOT_DIR"
            echo ""
            echo "Re-rendering adapters for all CLIs..."
            ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all >/dev/null
            ;;
        *)
            echo "Aborted. No changes made."
            ;;
    esac
}

detect() {
    echo "Detecting CLIs and project stack..."
    echo ""
    echo "Available adapters:"
    list_adapters
    echo ""
    if [ -x "$RENDERER" ] || [ -f "$RENDERER" ]; then
        python3 "$RENDERER" --detect-stack --root "$ROOT_DIR"
    else
        echo "(project stack detection unavailable: $RENDERER not found)"
    fi
}

render_one() {
    local cli="$1"
    if [ ! -d "$ADAPTERS_DIR/$cli" ]; then
        echo "ERROR: No adapter for CLI '$cli' under $ADAPTERS_DIR/$cli/" >&2
        echo "       Available adapters:" >&2
        for d in "$ADAPTERS_DIR"/*/; do
            [ -d "$d" ] || continue
            n=$(basename "$d")
            [ "$n" = "_common" ] || [ "$n" = "_generic" ] && continue
            echo "         - $n" >&2
        done
        echo "       For unknown CLIs, read $ROOT_DIR/.agents/BOOTSTRAP.md" >&2
        return 1
    fi
    if [ ! -f "$RENDERER" ]; then
        echo "ERROR: Renderer not found at $RENDERER" >&2
        return 1
    fi
    python3 "$RENDERER" --cli "$cli" --root "$ROOT_DIR"
}

render_all() {
    local rc=0
    for dir in "$ADAPTERS_DIR"/*/; do
        [ -d "$dir" ] || continue
        name=$(basename "$dir")
        [ "$name" = "_common" ] || [ "$name" = "_generic" ] && continue
        if ls "$dir"/*.tmpl &>/dev/null; then
            echo "=== Rendering for $name ==="
            if ! render_one "$name"; then
                rc=1
            fi
            echo ""
        fi
    done
    return $rc
}

check_drift() {
    echo "Checking adapter consistency (re-render and diff)..."
    local rc=0
    for dir in "$ADAPTERS_DIR"/*/; do
        [ -d "$dir" ] || continue
        name=$(basename "$dir")
        [ "$name" = "_common" ] || [ "$name" = "_generic" ] && continue
        if ls "$dir"/*.tmpl &>/dev/null; then
            if ! python3 "$RENDERER" --cli "$name" --root "$ROOT_DIR" --check; then
                rc=1
            fi
        fi
    done
    return $rc
}

case "${1:-help}" in
    detect)            detect ;;
    --detect)          detect ;;
    --list-adapters)   list_adapters ;;
    --list-orphans)    list_orphans ;;
    --list-examples)   list_examples ;;
    init)              shift; init_show "$@"; exit $? ;;
    prune)             prune_orphans ;;
    profile)           shift; profile_run "$@" ;;
    add-agent)         shift; add_agent_run "$@" ;;
    remove-examples)   shift; remove_examples_run "$@" ;;
    --all)             render_all ;;
    --check)
        shift
        if [ $# -eq 0 ]; then
            check_drift
        else
            rc=0
            for cli in "$@"; do
                if ! python3 "$RENDERER" --cli "$cli" --root "$ROOT_DIR" --check; then
                    rc=1
                fi
            done
            exit $rc
        fi
        ;;
    --help|-h|help)    print_help ;;
    *)
        cli="$1"
        shift
        if [ "${1:-}" = "--check" ]; then
            python3 "$RENDERER" --cli "$cli" --root "$ROOT_DIR" --check
            exit $?
        else
            render_one "$cli"
        fi
        ;;
esac
