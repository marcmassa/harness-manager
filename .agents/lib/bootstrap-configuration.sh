# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
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
                    ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
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
            ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
            ;;
        *)
            echo "Aborted. No changes made."
            ;;
    esac
}

detect() {
    if [ "${1:-}" = "--clis" ]; then
        detect_clis
        return 0
    fi
    echo "Detecting CLIs and project stack..."
    echo ""
    echo "Available adapters:"
    list_adapters
    echo ""
    echo "Project stack:"
    if [ -x "$RENDERER" ] || [ -f "$RENDERER" ]; then
        python3 "$RENDERER" --detect-stack --root "$ROOT_DIR"
    else
        echo "(project stack detection unavailable: $RENDERER not found)"
    fi
}

detect_clis() {
    ROOT_DIR="$ROOT_DIR" python3 - <<'PYEOF'
import json, os
root = os.environ.get("ROOT_DIR", os.getcwd())
owned = {
    "opencode": ["opencode.json"],
    "gemini-cli": ["GEMINI.md", ".gemini"],
    "claude-code": ["CLAUDE.md", ".claude"],
    "cursor": [".cursor/rules/harness-sdd.mdc", ".cursor/commands", ".cursor/hooks.json"],
    "codex": [".codex/prompts"],
}
out = {}
for name, paths in owned.items():
    existing = [p for p in paths if os.path.exists(os.path.join(root, p))]
    out[name] = {"generated_paths": existing, "state": "present" if existing else "absent"}
out["host_hints"] = {
    var: ("set" if os.environ.get(var) else "unset")
    for var in ("CLAUDECODE", "CURSOR_TRACE_ID")
}
print(json.dumps(out, indent=2))
PYEOF
}

get_target_clis() {
    python3 -c "
import json
m = json.load(open('$ROOT_DIR/.agents/agentic.json'))
tc = m.get('target_clis')
print('\n'.join(tc) if isinstance(tc, list) else '')
" 2>/dev/null
}

set_target_clis() {
    python3 - "$ROOT_DIR" "$@" <<'PYEOF'
import json, sys
root, names = sys.argv[1], [a for a in sys.argv[2:] if a]
path = root + "/.agents/agentic.json"
m = json.load(open(path))
m["target_clis"] = names
with open(path, "w") as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
    f.write("\n")
PYEOF
}

clean_adapters() {
    local all_flag=""
    local keep=()
    while [ $# -gt 0 ]; do
        case "$1" in
            --all) all_flag="1" ;;
            -*) echo "ERROR: unknown clean option: $1" >&2; return 1 ;;
            *) keep+=("$1") ;;
        esac
        shift
    done

    if [ -n "$all_flag" ]; then
        :
    elif [ ${#keep[@]} -gt 0 ]; then
        :
    else
        # shellcheck disable=SC2207
        keep=($(get_target_clis))
        if [ ${#keep[@]} -eq 0 ]; then
            echo "ERROR: no target_clis declared in .agents/agentic.json and no CLI arguments given." >&2
            echo "Usage: ./.agents/bootstrap.sh clean [cli...] | clean --all" >&2
            return 1
        fi
    fi

    local removed=0
    local paths p
    paths=$(python3 - "$ROOT_DIR" "${keep[@]:-}" <<'PYEOF'
import json, os, glob, sys
root = sys.argv[1]
keep = set(a for a in sys.argv[2:] if a)
owned = {
    "opencode": ["opencode.json"],
    "gemini-cli": ["GEMINI.md", ".gemini"],
    "claude-code": ["CLAUDE.md", ".claude"],
    "cursor": [".cursor/rules/harness-sdd.mdc", ".cursor/hooks.json"]
              + [os.path.relpath(p, root) for p in glob.glob(os.path.join(root, ".cursor", "commands", "harness-*.md"))],
    "codex": [os.path.relpath(p, root) for p in glob.glob(os.path.join(root, ".codex", "prompts", "harness-*.md"))],
}
for cli in owned:
    if cli in keep:
        continue
    for p in owned[cli]:
        print(p)
PYEOF
)
    while IFS= read -r p; do
        [ -z "$p" ] && continue
        if [ -e "$ROOT_DIR/$p" ]; then
            rm -rf "$ROOT_DIR/$p"
            echo "removed: $p"
            removed=$((removed + 1))
        fi
    done <<< "$paths"
    [ "$removed" -eq 0 ] && echo "nothing to clean"
    return 0
}

