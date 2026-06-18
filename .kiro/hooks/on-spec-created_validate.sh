#!/bin/bash
# Hook: on_spec_created — valida estructura del spec y requisitos EARS
set -euo pipefail
SPEC_DIR="$ROOT_DIR/specs/${FEATURE_NAME:-}"
if [ ! -d "$SPEC_DIR" ]; then
    echo "WARN: spec directory $SPEC_DIR not found"
    exit 0
fi
COUNT=$(find "$SPEC_DIR" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')
if [ "$COUNT" -ne 3 ]; then
    echo "WARN: expected 3 .md files in $SPEC_DIR, found $COUNT"
fi
if ! grep -q '^### R[0-9]' "$SPEC_DIR/requirements.md" 2>/dev/null; then
    echo "WARN: no EARS requirements (### R<n>) found in $SPEC_DIR/requirements.md"
fi
echo "Spec structure validation complete"
