# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
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
    python3 "$RENDERER" --cli "$cli" --root "$ROOT_DIR" && auto_scaffold_content
}

render_all() {
    local force_all=""
    for arg in "$@"; do
        case "$arg" in
            --yes|-y|--force) force_all="1" ;;
            --all) ;;
            *) ;;
        esac
    done

    local rc=0
    local rendered=0

    local declared
    declared=$(get_target_clis | tr '\n' ' ')

    if [ -n "${declared// /}" ]; then
        # target_clis declared: render only that list (FEAT-007 R5/R6)
        local name
        for name in $declared; do
            if [ -d "$ADAPTERS_DIR/$name" ]; then
                echo "=== Rendering for $name (target_clis) ==="
                if ! render_one "$name"; then
                    rc=1
                fi
                rendered=$((rendered + 1))
                echo ""
            else
                echo "  (no prebuilt adapter for '$name' — the LLM fallback in .agents/BOOTSTRAP.md handles it)"
            fi
        done
        if [ "$rendered" -eq 0 ]; then
            echo "No prebuilt adapters were rendered — target_clis names no prebuilt adapter."
        fi
        return $rc
    fi

    # target_clis not declared: prompt-first selection (FEAT-007 R3)
    if [ -t 0 ]; then
        local evidence present_list answer custom sel
        evidence=$(detect_clis)
        echo "Observed CLI evidence:"
        echo "$evidence" | sed 's/^/  /'
        echo ""
        present_list=$(echo "$evidence" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('\n'.join(k for k, v in d.items() if isinstance(v, dict) and v.get('state') == 'present'))
")
        if [ -z "$present_list" ]; then
            present_list="opencode"
        fi
        echo "Proposed target_clis: $(echo "$present_list" | tr '\n' ' ')"
        printf "Use this target_clis? [y/n/edit]: "
        read -r answer
        case "$answer" in
            y|Y|yes|YES)
                # shellcheck disable=SC2086
                set_target_clis $present_list
                echo "Persisted target_clis in .agents/agentic.json"
                ;;
            n|N|no|NO)
                echo "Aborted. Nothing rendered, nothing changed."
                return 0
                ;;
            *)
                echo "Enter the adapter names, space-separated (e.g. opencode cursor):"
                read -r custom
                # shellcheck disable=SC2086
                set_target_clis $custom
                echo "Persisted target_clis: $custom"
                ;;
        esac
        sel=$(get_target_clis | tr '\n' ' ')
        for name in $sel; do
            if [ -d "$ADAPTERS_DIR/$name" ]; then
                echo "=== Rendering for $name ==="
                if ! render_one "$name"; then
                    rc=1
                fi
                rendered=$((rendered + 1))
                echo ""
            else
                echo "  (no prebuilt adapter for '$name' — the LLM fallback in .agents/BOOTSTRAP.md handles it)"
            fi
        done
        if [ "$rendered" -eq 0 ]; then
            echo "No prebuilt adapters were rendered."
        fi
        return $rc
    fi

    # Non-interactive and undeclared: opencode only, no litter (FEAT-007 R4)
    echo "No target_clis declared — non-interactive run renders opencode only."
    echo "Make the choice explicit: declare target_clis in .agents/agentic.json, or run ./.agents/bootstrap.sh --all interactively."
    echo ""
    if [ -d "$ADAPTERS_DIR/opencode" ]; then
        echo "=== Rendering for opencode (default) ==="
        if ! render_one "opencode"; then
            rc=1
        fi
        rendered=$((rendered + 1))
        echo ""
    fi
    if [ "$rendered" -eq 0 ]; then
        echo "No adapters rendered. Available: $(ls -d "$ADAPTERS_DIR"/*/ 2>/dev/null | xargs -n1 basename | grep -v '^_' | tr '\n' ' ')"
    fi
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
            # FEAT-007: only verify consistency for adapters actually rendered in this tree
            case "$name" in
                gemini-cli)   [ -e "$ROOT_DIR/GEMINI.md" ] || [ -d "$ROOT_DIR/.gemini" ] || continue ;;
                claude-code)  [ -e "$ROOT_DIR/CLAUDE.md" ] || [ -d "$ROOT_DIR/.claude" ] || continue ;;
                opencode)     [ -e "$ROOT_DIR/opencode.json" ] || continue ;;
                cursor)
                    [ -e "$ROOT_DIR/.cursor/rules/harness-sdd.mdc" ] \
                        || [ -n "$(ls "$ROOT_DIR"/.cursor/commands/harness-*.md 2>/dev/null)" ] \
                        || [ -e "$ROOT_DIR/.cursor/hooks.json" ] || continue ;;
                codex)        [ -n "$(ls "$ROOT_DIR"/.codex/prompts/harness-*.md 2>/dev/null)" ] || continue ;;
            esac
            if ! python3 "$RENDERER" --cli "$name" --root "$ROOT_DIR" --check; then
                rc=1
            fi
        fi
    done
    return $rc
}

