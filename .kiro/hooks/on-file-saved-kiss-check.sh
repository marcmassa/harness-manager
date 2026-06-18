#!/bin/bash
# on-file-saved-kiss-check.sh — KISS (anti-overengineering) hook for saved TS/TSX files
#
# Implements FEAT-027 R3, R4, R5, R6, R7.
# Reads a file path from $FILE (or argv[1] for direct invocation).
# Delegates to hooks/kiss_check.py.
#
# ROOT_DIR resolution order:
#   1. $ROOT_DIR env var (set by run-hooks.sh or the extension)
#   2. parent of the script's own directory (the project root)

set -uo pipefail

# Resolve root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
export ROOT_DIR

# Prefer $FILE env var (matches the run-hooks.sh convention); fall back to argv[1]
FILE="${FILE:-${1:-}}"
if [ -z "$FILE" ]; then
    echo "ERROR: usage: on-file-saved-kiss-check.sh <file>  OR  FILE=<file> $0" >&2
    exit 64
fi
if [ ! -f "$FILE" ]; then
    echo "ERROR: file not found: $FILE" >&2
    exit 66
fi

# Make the file path absolute so the python script can read it without
# depending on the caller's cwd (the run-hooks.sh runner sets cwd to ROOT_DIR).
case "$FILE" in
    /*) ABS_FILE="$FILE" ;;
    *)  ABS_FILE="$ROOT_DIR/$FILE" ;;
esac

python3 "$ROOT_DIR/hooks/kiss_check.py" "$ABS_FILE"
