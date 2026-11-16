# Sourced by .agents/bootstrap.sh; shares its root and adapter context.
print_help() {
    sed -n '2,20p' "$0" | sed 's/^# \?//'
}

list_adapters() {
    echo "Available adapters in $ADAPTERS_DIR:"
    seen=""
    if [ -f "$RENDERER" ]; then
        while IFS= read -r name; do
            [ -z "$name" ] && continue
            echo "  - $name"
            seen="$seen $name "
        done < <(python3 "$RENDERER" --list-renderers --root "$ROOT_DIR")
    fi
    for dir in "$ADAPTERS_DIR"/*/; do
        [ -d "$dir" ] || continue
        name=$(basename "$dir")
        [ "$name" = "_common" ] && continue
        [ "$name" = "_generic" ] && continue
        case " $seen " in
            *" $name "*) continue ;;
        esac
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
            ROOT_DIR="$ROOT_DIR" "$ROOT_DIR/.agents/bootstrap.sh" --all --yes >/dev/null
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

