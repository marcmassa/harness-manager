# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
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
    local n_steering_scaffolds
    n_steering_scaffolds=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('_template_steering_examples', [])))")
    local n_hooks_scaffolds
    n_hooks_scaffolds=$(python3 -c "import json; m=json.load(open('$manifest')); print(len(m.get('_template_hooks_examples', [])))")
    local total_scaffolds=$((n_scaffolds + n_steering_scaffolds + n_hooks_scaffolds))

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
    if [ "${n_active:-0}" -eq 0 ] && [ "${total_scaffolds:-0}" -gt 0 ]; then
        echo "  State:  FRESH INSTALL — subagents[] is empty, $total_scaffolds scaffold(s) in _template_* arrays"
        echo "          (${n_scaffolds:-0} sub-agent(s), ${n_steering_scaffolds:-0} steering, ${n_hooks_scaffolds:-0} hook(s))."
        echo "          The agent should run /init to shape the manifest to this project."
        echo "          Suggested next command: tell the agent \"run /init\"."
    elif [ "${n_active:-0}" -gt 0 ] && [ "${total_scaffolds:-0}" -gt 0 ]; then
        echo "  State:  PARTIAL — subagents[] has $n_active entries (project-specific), $total_scaffolds scaffold(s) remain"
        echo "          (${n_scaffolds:-0} sub-agent(s), ${n_steering_scaffolds:-0} steering, ${n_hooks_scaffolds:-0} hook(s))."
        echo "          The agent should finish /init by running 'remove-examples' once the project's"
        echo "          sub-agents, steering files, and hooks are in place."
    elif [ "${n_active:-0}" -gt 0 ] && [ "${total_scaffolds:-0}" -eq 0 ]; then
        echo "  State:  INITIALIZED — subagents[] has $n_active project-specific entry(ies), no scaffolds remain."
        echo "          The project is shaped. /init is not needed again."
    else
        echo "  State:  EMPTY — subagents[] and all _template_* arrays are empty."
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
    echo "  Steering scaffolds (_template_steering_examples[]):"
    if [ "${n_steering_scaffolds:-0}" -gt 0 ]; then
        python3 -c "
import json
m = json.load(open('$manifest'))
for a in m.get('_template_steering_examples', []):
    applies = a.get('applies_to', ['*'])
    intent = a.get('_intent', '').split('.')[0][:60]
    print(f'    - {a[\"name\"]:<24} applies_to={applies}  {intent}')
"
    else
        echo "    (none)"
    fi
    echo ""
    echo "  Hook scaffolds (_template_hooks_examples[]):"
    if [ "${n_hooks_scaffolds:-0}" -gt 0 ]; then
        python3 -c "
import json
m = json.load(open('$manifest'))
for a in m.get('_template_hooks_examples', []):
    failure = a.get('on_failure', 'warn')
    intent = a.get('_intent', '').split('.')[0][:60]
    print(f'    - {a[\"event\"]:<28} on_failure={failure}  {intent}')
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
    echo "    4. Decide which steering files and hooks the project needs."
    echo "       Use ./bootstrap.sh add-steering <name> and add-hook --event <event> --script <path>."
    echo "    5. ./bootstrap.sh remove-examples --yes   (drop the scaffolds)."
    echo "    6. ./bootstrap.sh init --validate         (objective completion gate, must exit 0)."
    echo "    7. ./check.sh                              (must be green)."
    echo ""
    echo "  Tell the agent: \"run /init\"  (or invoke the init slash command directly)."
    echo "  Completion gate: ./bootstrap.sh init --validate   (MUST exit 0 before init is declared done)"
    echo ""
    echo "  Reference: AGENTS.md §0.5 — Project Profiling (3-stage lifecycle)."
}

profile_run() {
    local report
    report=$(python3 "$RENDERER" --profile --root "$ROOT_DIR") || return $?
    echo "Project profile (scaffold lifecycle):"
    printf '%s\n' "$report" | python3 "$BOOTSTRAP_LIB/profile_report.py" "$ROOT_DIR"
}

