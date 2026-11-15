#!/bin/bash
# bootstrap.sh — Generate the native config adapter for your CLI from .agents/agentic.json
#
# Workflow:
#   ./.agents/bootstrap.sh <cli>                 # Render the native config for <cli>
#   ./.agents/bootstrap.sh --all                 # Render all adapters (prompts for non-opencode CLIs)
#   ./.agents/bootstrap.sh --all --yes           # Render all adapters without prompting
#   ./.agents/bootstrap.sh --check               # Re-render to a temp file and diff; exit 1 if drift
#   ./.agents/bootstrap.sh detect                # Detect available CLIs and project stack
#   ./.agents/bootstrap.sh export <dest>         # Copy the portable template into <dest>
#   ./.agents/bootstrap.sh spec-digest <dir>     # Deterministic requirements+design digest
#   ./.agents/bootstrap.sh workflow-validate ... # Validate a transition without mutation
#   ./.agents/bootstrap.sh workflow-transition ...# Validated, journaled state transition
#   ./.agents/bootstrap.sh workflow-init ...     # Create the work record for a feature
#   ./.agents/bootstrap.sh workflow-approve ...  # Record a declared human spec decision
#   ./.agents/bootstrap.sh workflow-scope-change ... # Record a human-authorized scope change
#   ./.agents/bootstrap.sh workflow-evidence ... # Add requirement evidence for HEAD
#   ./.agents/bootstrap.sh workflow-run-checks ...# Run check.sh and record the observed result
#   ./.agents/bootstrap.sh workflow-review ...   # Record the independent closing review
#   ./.agents/bootstrap.sh workflow-recover ...  # Human-confirmed failed-hook recovery
#   ./.agents/bootstrap.sh workflow-rollback ... # Undo an interrupted two-file mutation
#   ./.agents/bootstrap.sh workflow-check        # Validate policy and all work records
#   ./.agents/bootstrap.sh version               # Framework and format versions; installed inventory status
#   ./.agents/bootstrap.sh inventory-adopt <dir> # Give a legacy install an inventory, judged against an export in <dir>
#   ./.agents/bootstrap.sh update-plan <project>  # Non-mutating per-file update plan for an installed project
#   ./.agents/bootstrap.sh update-apply <project> --plan <digest>  # Apply a reviewed plan, with backup
#   ./.agents/bootstrap.sh update-restore <project>               # Undo the last update
#   ./.agents/bootstrap.sh update-keep <project> <path>...        # Make conflicting paths project-owned
#   ./.agents/bootstrap.sh update-accept <project> <path>...      # Resolve conflicts with the release version (backed up)
#   ./.agents/bootstrap.sh update-adopt <project>                 # Inventory for a legacy install
#   ./.agents/bootstrap.sh brief                 # Compact session brief (use instead of reading state files)
#   ./.agents/bootstrap.sh archive-log <file>    # Move an oversized progress log to progress/archive/
#   ./.agents/bootstrap.sh detect --clis         # Observe CLI evidence (generated adapters, host hints)
#   ./.agents/bootstrap.sh clean [cli...] | --all # Delete generated adapters of CLIs not in target_clis
#
# Scaffold lifecycle (project shaping):
#   ./.agents/bootstrap.sh init                  # Show /init workflow + current scaffold-lifecycle state
#   ./.agents/bootstrap.sh init --validate       # Objective completion gate (exits 0 if /init is complete)
#   ./.agents/bootstrap.sh profile               # Report: active set + matching template examples
#   ./.agents/bootstrap.sh add-agent <name>      # Promote a template example to the active manifest
#   ./.agents/bootstrap.sh add-agent --all-matched  # Promote all examples that match this project
#   ./.agents/bootstrap.sh remove-examples       # Drop template scaffolds from the manifest (final stage)
#   ./.agents/bootstrap.sh add-steering <name>    # Add a steering file and register in agentic.json
#   ./.agents/bootstrap.sh remove-steering <name> # Remove a steering entry from agentic.json
#   ./.agents/bootstrap.sh --list-steering        # List current steering files
#   ./.agents/bootstrap.sh add-hook                # Add a lifecycle hook (--event, --script, --on-failure)
#   ./.agents/bootstrap.sh remove-hook             # Remove a hook entry from agentic.json
#   ./.agents/bootstrap.sh --list-hooks            # List registered hooks
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

BOOTSTRAP_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/lib" && pwd)"
source "$BOOTSTRAP_LIB/bootstrap-common.sh"
source "$BOOTSTRAP_LIB/bootstrap-extensions.sh"
source "$BOOTSTRAP_LIB/bootstrap-lifecycle.sh"
source "$BOOTSTRAP_LIB/bootstrap-configuration.sh"
source "$BOOTSTRAP_LIB/bootstrap-content.sh"
source "$BOOTSTRAP_LIB/bootstrap-render.sh"

# An unknown manifest or inventory format is refused before any command can change files.
case "${1:-help}" in
    --help|-h|help|version|brief) ;;
    *) python3 "$BOOTSTRAP_LIB/inventory.py" --root "$ROOT_DIR" --check || exit 1 ;;
esac

case "${1:-help}" in
    version)
        python3 "$BOOTSTRAP_LIB/inventory.py" --root "$ROOT_DIR" --describe
        exit $?
        ;;
    update-plan|update-apply|update-restore|update-keep|update-accept|update-adopt)
        operation="${1#update-}"
        shift
        if [ -z "${1:-}" ]; then
            echo "Usage: ./.agents/bootstrap.sh update-$operation <project-dir> [options]" >&2
            exit 1
        fi
        python3 "$BOOTSTRAP_LIB/update.py" --source "$ROOT_DIR" "$operation" "$@"
        exit $?
        ;;
    inventory-adopt)
        shift
        if [ -z "${1:-}" ]; then
            echo "Usage: ./.agents/bootstrap.sh inventory-adopt <exported-release-dir>" >&2
            exit 1
        fi
        python3 "$BOOTSTRAP_LIB/inventory.py" --root "$ROOT_DIR" --adopt "$1"
        exit $?
        ;;
    export)
        shift
        if [ -z "${1:-}" ]; then
            echo "Usage: ./.agents/bootstrap.sh export <dest>" >&2
            exit 1
        fi
        python3 "$RENDERER" --export "$1" --root "$ROOT_DIR" || exit $?
        # Small consumer guides and the shared hook policy accompany the gateway.
        for rel in docs/team-policy.md docs/workflow-contract.md docs/trusted-review.md docs/team-policy/example.json docs/framework-overview.md docs/framework-workflow.md docs/framework-customization.md docs/quality-checks.md .githooks/pre-commit .githooks/token_limit.py .githooks/README.md; do
            if [ -f "$ROOT_DIR/$rel" ]; then
                mkdir -p "$1/$(dirname "$rel")" || exit $?
                cp -p "$ROOT_DIR/$rel" "$1/$rel" || exit $?
            fi
        done
        # This repository ignores its own framework specs; a consumer's specs must be committable.
        if [ -f "$1/.gitignore" ]; then
            sed -E '/^!?\/specs\//d' "$1/.gitignore" > "$1/.gitignore.export" || exit $?
            mv "$1/.gitignore.export" "$1/.gitignore" || exit $?
        fi
        # A consumer starts unreviewed: the maintainer's acceptance is never exported.
        if [ -f "$ROOT_DIR/docs/team-policy/scenarios.json" ]; then
            mkdir -p "$1/docs/team-policy" || exit $?
            python3 "$BOOTSTRAP_LIB/team_policy.py" --sanitize-scenarios \
                "$ROOT_DIR/docs/team-policy/scenarios.json" "$1/docs/team-policy/scenarios.json" || exit $?
        fi
        # Synced skills are machine-local (git-ignored): a release ships only the sync tooling.
        find "$1/.agents/skills" -mindepth 1 -maxdepth 1 ! -name 'README.md' ! -name 'sync-skills.sh' -exec rm -rf {} + 2>/dev/null || true
        # Record what was installed: version, formats, and a baseline digest per owned path.
        python3 "$BOOTSTRAP_LIB/inventory.py" --root "$1" --create >/dev/null || exit $?
        exit 0
        ;;
    spec-digest)
        shift
        if [ -z "${1:-}" ]; then
            echo "Usage: ./.agents/bootstrap.sh spec-digest <spec-dir>" >&2
            exit 1
        fi
        python3 "$BOOTSTRAP_LIB/workflow_cli.py" --root "$ROOT_DIR" digest --spec-dir "$1"
        exit $?
        ;;
    brief)
        python3 "$BOOTSTRAP_LIB/session_brief.py" --root "$ROOT_DIR"
        exit $?
        ;;
    archive-log)
        shift
        if [ -z "${1:-}" ]; then
            echo "Usage: ./.agents/bootstrap.sh archive-log progress/<file>.md" >&2
            exit 1
        fi
        python3 "$BOOTSTRAP_LIB/session_brief.py" --root "$ROOT_DIR" --archive "$1"
        exit $?
        ;;
    workflow-*)
        operation="${1#workflow-}"
        shift
        python3 "$BOOTSTRAP_LIB/workflow_cli.py" --root "$ROOT_DIR" "$operation" "$@"
        exit $?
        ;;
    detect)            shift; detect "$@" ;;
    --detect)          detect ;;
    clean)             shift; clean_adapters "$@" ;;
    --list-adapters)   list_adapters ;;
    --list-orphans)    list_orphans ;;
    --list-examples)   list_examples ;;
    init)              shift; init_show "$@"; exit $? ;;
    prune)             prune_orphans ;;
    profile)           shift; profile_run "$@" ;;
    add-agent)         shift; add_agent_run "$@" ;;
    remove-examples)   shift; remove_examples_run "$@" ;;
    add-steering)      shift; add_steering_run "$@" ;;
    remove-steering)   shift; remove_steering_run "$@" ;;
    --list-steering)   list_steering ;;
    add-hook)          shift; add_hook_run "$@" ;;
    remove-hook)       shift; remove_hook_run "$@" ;;
    --list-hooks)      list_hooks ;;
    --all)             shift; render_all "$@" ;;
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
