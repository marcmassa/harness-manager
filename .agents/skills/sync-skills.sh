#!/bin/bash
# Download skills from the central registry into .agents/skills/.
#
# Skills are instructions that agents load and follow, so the registry is part
# of the project's trust base. Pin it to a reviewed commit:
#
#   .agents/agentic.json:  "skills": {"registry": {"url": "<git url>", "ref": "<40-hex commit>"}}
#   or the environment:    SKILLS_REGISTRY_URL, SKILLS_REGISTRY_REF
#
# With a ref, exactly that commit is installed or nothing changes. Without one
# the registry's default branch is used and a warning names the commit to pin.
# The current skills are replaced only after the download has been validated.
set -euo pipefail

DEFAULT_URL="https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SKILLS_DIR="$ROOT_DIR/.agents/skills"
MANIFEST="$ROOT_DIR/.agents/agentic.json"

fail() { echo "Error: $1" >&2; exit 1; }

setting() {
    [ -f "$MANIFEST" ] || return 0
    python3 - "$MANIFEST" "$1" <<'PY' || fail ".agents/agentic.json could not be read"
import json, sys
skills = json.load(open(sys.argv[1], encoding='utf-8')).get('skills')
registry = skills.get('registry') if isinstance(skills, dict) else None
value = registry.get(sys.argv[2]) if isinstance(registry, dict) else None
print(value if isinstance(value, str) else '')
PY
}

URL="${SKILLS_REGISTRY_URL:-$(setting url)}"
URL="${URL:-$DEFAULT_URL}"
REF="${SKILLS_REGISTRY_REF:-$(setting ref)}"
if [ -n "$REF" ] && ! [[ "$REF" =~ ^[0-9a-f]{40}$ ]]; then
    fail "the registry ref must be a full 40-character commit id, not a branch or tag"
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/harness-skills.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
git_safe() { git -c core.hooksPath=/dev/null -c advice.detachedHead=false "$@"; }

echo "Updating skills from $URL"
if [ -n "$REF" ]; then
    git_safe init --quiet "$WORK/repo"
    if git_safe -C "$WORK/repo" fetch --quiet --depth 1 --no-tags "$URL" "$REF" 2>/dev/null; then
        git_safe -C "$WORK/repo" checkout --quiet --detach FETCH_HEAD
    else
        # The server does not serve single commits: clone, then select the pinned one.
        rm -rf "$WORK/repo"
        git_safe clone --quiet --no-tags --no-recurse-submodules "$URL" "$WORK/repo" \
            || fail "could not reach the skills registry"
        git_safe -C "$WORK/repo" checkout --quiet --detach "$REF" 2>/dev/null \
            || fail "pinned commit $REF is not in the registry"
    fi
else
    git_safe clone --quiet --depth 1 --no-tags --no-recurse-submodules "$URL" "$WORK/repo" \
        || fail "could not reach the skills registry"
fi

HEAD_ID="$(git -C "$WORK/repo" rev-parse HEAD)"
if [ -n "$REF" ] && [ "$HEAD_ID" != "$REF" ]; then
    fail "registry commit $HEAD_ID does not match the pinned ref $REF"
fi

SOURCE="$WORK/repo/skills"
[ -d "$SOURCE" ] && [ ! -L "$SOURCE" ] || fail "the registry has no skills/ directory"
[ -n "$(find "$SOURCE" -mindepth 1 -maxdepth 1 -print -quit)" ] || fail "the registry skills/ directory is empty"
if [ -n "$(find "$SOURCE" -type l -print -quit)" ]; then
    fail "the registry contains symbolic links under skills/; refusing to install them"
fi

mkdir -p "$SKILLS_DIR"
# Validated: only now are the current skills replaced (README.md and this script are kept).
find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 ! -name 'README.md' ! -name 'sync-skills.sh' -exec rm -rf {} +
for entry in "$SOURCE"/*; do
    name="$(basename "$entry")"
    case "$name" in README.md|sync-skills.sh) continue ;; esac
    cp -R "$entry" "$SKILLS_DIR/$name"
done

echo "Skills updated from commit $HEAD_ID."
if [ -z "$REF" ]; then
    echo "WARNING: the registry is not pinned, so the next sync may install different instructions." >&2
    echo "         Review this version, then set skills.registry.ref to $HEAD_ID in .agents/agentic.json." >&2
fi
