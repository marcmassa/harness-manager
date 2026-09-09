#!/usr/bin/env bash
# scripts/vsix-gate.sh — VSIX packaging gate (FEAT-038 vsix-asset-diet)
#
# Single source of assertions for the DESIGN.md §2.4 "400 KB budget"
# (amended by ADR-005 from the original 300 KB) and the packaging
# invariants of FEAT-038. Runs against a produced .vsix
# artifact (the package's own `unzip -l` listing — the manifest, not the
# repo tree). Enforcement points (design §6, R7):
#   1. `npm run package` — appended after `vsce package`
#   2. `.github/workflows/ci.yml` — via the `Package VSIX + size gate` step
#   3. `.github/workflows/publish.yml` — between Package and Publish
# NOT wired into ./check.sh by design (check.sh stays free of packaging).
#
# Assertions:
#   GATE: size       artifact < 400000 decimal bytes            → R5 (ADR-005)
#   GATE: exclusion  no extension/media/screenshots/… zip entries    → R1/R6
#   GATE: presence   icon.png, icon.svg + dist/extension.cjs,
#                    dist/webview.js, dist/webview.css all present   → R4/R6
#   SIGNAL: utilization  non-blocking — prints budget utilization; at
#                    ≥80% of LIMIT prints a REVIEW line (never fails).
#
# Any violation prints the offending `unzip -l` lines and exits non-zero.
# `scripts/` is itself .vscodeignore'd — this gate adds zero package bytes.
#
# Usage: bash scripts/vsix-gate.sh <path-to-vsix>
#
# Artifact-name resolution: `vsce package` without --out produces
# <name>-<version>.vsix (here: harness-dashboard-vscode-<version>.vsix).
# npm run package derives the version live from package.json
# (`node -p "require('./package.json').version"`) instead of a glob, so a
# version bump needs no script edit and stale root-level .vsix fixtures
# (pre-diet artifacts kept for testing) can never be gated by mistake.
# publish.yml pins its own name via `--out harness-dashboard.vsix`.
set -u

VSIX="${1:-}"

if [ -z "$VSIX" ]; then
	echo "usage: $0 <path-to-vsix>"
	echo ""
	echo "FEAT-038 packaging gate — asserts on a produced .vsix artifact:"
	echo "  size < 400000 B (decimal, ADR-005) | no extension/media/screenshots/ entries"
	echo "  | required media + dist entries present"
	exit 2
fi

if [ ! -f "$VSIX" ]; then
	echo "GATE ERROR: artifact not found: $VSIX" >&2
	exit 2
fi

SIZE=$(wc -c < "$VSIX" | tr -d ' ')
LIMIT=400000
LISTING=$(unzip -l "$VSIX")

fail=0

# --- GATE: size (R5, budget amended to 400,000 B by ADR-005) ----------------
if [ "$SIZE" -ge "$LIMIT" ]; then
	echo "GATE FAIL [size]: $VSIX is $SIZE bytes (budget: < $LIMIT B, DESIGN.md §2.4, ADR-005)." >&2
	echo "  If legitimate code growth breaches the budget, the response is an" >&2
	echo "  explicit DESIGN.md amendment — never a quietly raised threshold here." >&2
	fail=1
else
	echo "GATE PASS [size]: $VSIX is $SIZE bytes (< $LIMIT B budget)."
fi

# --- SIGNAL: budget utilization (non-blocking, ADR-005) ----------------------
# Prints integer percent of the artifact vs LIMIT on every run. At >=80% it
# ALSO prints a REVIEW line: growth past that point should be a conscious
# decision. The signal NEVER affects the exit code.
UTIL=$(( SIZE * 100 / LIMIT ))
echo "budget utilization: ${UTIL}% (of ${LIMIT} B)"
if [ "$UTIL" -ge 80 ]; then
	echo "REVIEW: payload ≥80% of budget — growth should be a conscious decision (ADR-005)"
fi

# --- GATE: exclusion (R1 / R6) ---------------------------------------------
SCREENSHOTS=$(echo "$LISTING" | grep 'extension/media/screenshots/' || true)
if [ -n "$SCREENSHOTS" ]; then
	echo "GATE FAIL [exclusion]: packaged VSIX contains README screenshots (FEAT-038 R1):" >&2
	echo "$SCREENSHOTS" >&2
	fail=1
else
	echo "GATE PASS [exclusion]: zero extension/media/screenshots/ entries."
fi

# --- GATE: presence (R4 / R6) ----------------------------------------------
REQUIRED="extension/media/icon.png extension/media/icon.svg extension/dist/extension.cjs extension/dist/webview.js extension/dist/webview.css"
missing=""
for entry in $REQUIRED; do
	if ! echo "$LISTING" | grep -q "  *$entry\$"; then
		missing="$missing$entry\n"
	fi
done
if [ -n "$missing" ]; then
	echo "GATE FAIL [presence]: required entries missing from the package (FEAT-038 R4):" >&2
	printf "$missing" >&2
	echo "Offending/expected listing for reference:" >&2
	echo "$LISTING" | grep -E 'extension/(media|dist)/' >&2
	fail=1
else
	echo "GATE PASS [presence]: icon.png, icon.svg, dist/extension.cjs, dist/webview.js, dist/webview.css all packaged."
fi

if [ "$fail" -ne 0 ]; then
	echo ""
	echo "VSIX GATE: FAILED ($VSIX)" >&2
	exit 1
fi

echo ""
echo "VSIX GATE: PASSED ($VSIX, $SIZE B)"
