#!/usr/bin/env bash
# check.sh — Harness SDD verification and environment initialization
#
# Runs builds, lints, tests, and SDD integrity validations. Acts as the gateway
# for declaring a task as done — if it fails, the task is not finished.
#
# Usage: ./check.sh [--verbose] [--py-only] [--ts-only] [--go-only] [--spec-only] [--no-color]
#
# Flags:
#   --verbose    Show full command output instead of tail-only
#   --py-only    Skip non-Python sections
#   --ts-only    Skip non-TypeScript sections
#   --go-only    Skip non-Go sections
#   --spec-only  Run only spec/infrastructure validations (fast CI gate for spec PRs)
#   --no-color   Disable ANSI colors
#
# Note: this script intentionally uses `set -uo pipefail` (NOT `-e`) so that
# individual `fail()` calls can decide whether to set the exit code. The exit
# code is finalized at the end based on the accumulated $EXIT_CODE.
#
# Customize by adding blocks for your stack:
#   - Terraform: terraform fmt -check, terraform validate
#   - Docker: hadolint
#   - Kubernetes: kustomize build, helm lint
#   - Security: checkov, tfsec, trivy

set -uo pipefail

VERBOSE=false
PY_ONLY=false
TS_ONLY=false
GO_ONLY=false
SPEC_ONLY=false
USE_COLOR=true
EXIT_CODE=0

for arg in "$@"; do
	case "$arg" in
		--verbose)   VERBOSE=true ;;
		--py-only)   PY_ONLY=true ;;
		--ts-only)   TS_ONLY=true ;;
		--go-only)   GO_ONLY=true ;;
		--spec-only) SPEC_ONLY=true ;;
		--no-color)  USE_COLOR=false ;;
	esac
done

if ! $USE_COLOR || [ ! -t 1 ]; then
	C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
else
	C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
fi

section() {
	echo ""
	echo "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
	echo "${C_BOLD}  $1${C_RESET}"
	echo "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
}

pass() { echo "  ${C_GREEN}✅ $1${C_RESET}"; }
fail() { echo "  ${C_RED}❌ $1${C_RESET}"; EXIT_CODE=1; }
warn() { echo "  ${C_YELLOW}⚠️  $1${C_RESET}"; }
info() { echo "  ${C_BLUE}ℹ️  $1${C_RESET}"; }

run_or_tail() {
	if $VERBOSE; then
		"$@"
	else
		"$@" 2>&1 | tail -10
	fi
}

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ── Stack checks ──────────────────────────────────
# Customize these blocks for your stack.
# Commented examples for Terraform, Docker, and K8s.

if ! $SPEC_ONLY && command -v terraform &>/dev/null; then
	section "Terraform — Format & Validate"
	terraform fmt -check -recursive 2>/dev/null && pass "terraform fmt" || warn "terraform fmt found differences (fix with 'terraform fmt')"
	terraform validate 2>/dev/null && pass "terraform validate" || warn "terraform validate has warnings"
fi

if ! $SPEC_ONLY && command -v tflint &>/dev/null; then
	section "Terraform — TFLint"
	tflint --recursive 2>&1 | tail -5 && pass "tflint" || warn "tflint found issues"
fi

if ! $SPEC_ONLY && [ -d "charts" ] && command -v helm &>/dev/null; then
	section "Helm — Lint"
	for chart in charts/*/; do
		helm lint "$chart" 2>/dev/null && pass "helm lint $chart" || warn "helm lint $chart"
	done
fi

# ── Python checks (if applicable) ─────────────────────
if ! $SPEC_ONLY && ! $TS_ONLY && ! $GO_ONLY; then
	has_python_files=false
	for pat in '*.py' '**/*.py'; do
		if ls $pat 2>/dev/null | grep -q .; then has_python_files=true; break; fi
	done
	if $has_python_files; then
		section "Python — Syntax check"
		python3 -m py_compile -x .venv -x __pycache__ . 2>/dev/null && pass "py_compile" || warn "py_compile found errors"

		section "Python — Tests"
		python_found_tests=false
		for d in tests test __tests__ spec tests-*; do
			if [ -d "$d" ]; then python_found_tests=true; break; fi
		done
		if $python_found_tests; then
			if command -v pytest &>/dev/null; then
				run_or_tail python3 -m pytest -v --tb=short -x
				if [ ${PIPESTATUS[0]} -eq 0 ]; then
					pass "pytest: all passed"
				else
					fail "pytest: broken tests"
				fi
			else
				warn "tests/ found but pytest is not available"
			fi
		fi
	fi
fi

# ── Go checks (if applicable) ─────────────────────────
if ! $SPEC_ONLY && ! $PY_ONLY && ! $TS_ONLY; then
	has_go_files=false
	for pat in '*.go' '**/*.go'; do
		if ls $pat 2>/dev/null | grep -q .; then has_go_files=true; break; fi
	done
	if $has_go_files && command -v go &>/dev/null; then
		section "Go — Build & Vet"
		go build ./... 2>/dev/null && pass "go build" || fail "go build"
		go vet ./... 2>/dev/null && pass "go vet" || fail "go vet"
		go test ./... -race -count=1 2>&1 | tail -5 && pass "go test -race" || fail "go test -race"
	fi
fi

# ── TypeScript checks (if applicable) ─────────────────
if ! $SPEC_ONLY && ! $PY_ONLY && ! $GO_ONLY && [ -f "package.json" ]; then
	section "TypeScript — Build"
	npm run build 2>&1 | tail -3 && pass "npm run build" || fail "npm run build"

	if [ -f "vitest.config.js" ] || [ -f "vitest.config.ts" ]; then
		section "TypeScript — Tests"
		npm test -- --run 2>&1 | tail -10 && pass "npm test" || warn "npm test: some tests failed"
	fi
fi

# ── Adapter consistency (regenerated from .agents/agentic.json) ─────
if [ -x "./.agents/bootstrap.sh" ] || [ -f "./.agents/bootstrap.sh" ]; then
	section "Adapter Consistency"
	adapter_outputs_found=0
	for f in opencode.json GEMINI.md CLAUDE.md; do
		if [ -f "$f" ]; then adapter_outputs_found=$((adapter_outputs_found + 1)); fi
	done
	if [ "$adapter_outputs_found" -eq 0 ]; then
		warn "No CLI adapter generated in repo root."
		echo "       Run ./.agents/bootstrap.sh <opencode|gemini-cli|claude-code> to generate one."
	else
		./.agents/bootstrap.sh --check 2>&1
		if [ $? -eq 0 ]; then
			pass "Generated adapters are in sync with .agents/agentic.json"
		else
			fail "Generated adapter drift detected. Run ./.agents/bootstrap.sh <cli> to refresh."
		fi
	fi
else
	warn "./.agents/bootstrap.sh not found — skipping adapter consistency"
fi

# ── Feature list validation ───────────────────────
section "Feature List Validation"
if [ -f "feature_list.json" ]; then
	if python3 -c "import json; json.load(open('feature_list.json'))" 2>/dev/null; then
		pass "feature_list.json is valid JSON"
	else
		fail "feature_list.json is NOT valid JSON"
	fi

	python3 /dev/stdin <<'PYEOF' 2>/dev/null || true
import json, os, sys
with open('feature_list.json') as f:
    data = json.load(f)

valid_status = {"pending", "spec_ready", "in_progress", "done", "blocked"}
errors = []
warnings = []

for feat in data['features']:
    if feat['status'] not in valid_status:
        errors.append(f"{feat['id']}: invalid status '{feat['status']}'")

in_progress = [f for f in data['features'] if f['status'] == 'in_progress']
if len(in_progress) > 1:
    names = ', '.join(f['id'] for f in in_progress)
    errors.append(f"Multiple features 'in_progress': {names}")

requires_spec = {"spec_ready", "in_progress", "done"}
for feat in data['features']:
    if feat.get('sdd') and feat['status'] in requires_spec:
        spec_dir = os.path.join('specs', feat['name'])
        for fname in ('requirements.md', 'design.md', 'tasks.md'):
            if not os.path.isfile(os.path.join(spec_dir, fname)):
                errors.append(f"{feat['id']}: sdd=true, status={feat['status']}, missing {spec_dir}/{fname}")

if errors:
    for e in errors:
        print(f"[ERROR] {e}")
    sys.exit(1)
elif warnings:
    for w in warnings:
        print(f"[WARN]  {w}")
    print(f"[OK]    feature_list.json valid ({len(data['features'])} features)")
else:
    print(f"[OK]    feature_list.json valid ({len(data['features'])} features)")
    in_prog = [f for f in data['features'] if f['status'] == 'in_progress']
    if in_prog:
        print(f"        1 feature in progress: {in_prog[0]['id']} — {in_prog[0]['name']}")
    else:
        print("        No features in progress")
PYEOF

	if [ $? -eq 0 ]; then
		pass "Feature list validation completed"
	else
		fail "Errors in feature_list.json"
	fi
else
	warn "feature_list.json not found — skipping"
fi

# ── Progress files check ──────────────────────────
section "Progress Files"
for f in progress/current.md progress/progress.md progress/backlog.md progress/decisions.md progress/handoff.md; do
	if [ -f "$f" ]; then
		pass "Exists $f"
	else
		warn "Missing $f"
	fi
done

# ── Sub-Agent check ───────────────────────────────
section "Sub-Agents"
for dir in .agents/subagents/*/; do
	name=$(basename "$dir")
	if [ -f "${dir}SUBAGENT.md" ]; then
		pass "Subagent $name (SUBAGENT.md)"
	else
		warn "Subagent $name: missing SUBAGENT.md"
	fi
done

if ! ls .agents/subagents/*/SUBAGENT.md &>/dev/null 2>&1; then
	warn "No subagents defined in .agents/subagents/"
fi

if [ -x "./.agents/bootstrap.sh" ] && [ -f ".agents/agentic.json" ]; then
	section "Subagent Consistency"
	orphans=$(./.agents/bootstrap.sh --list-orphans 2>/dev/null)
	if [ -z "$orphans" ]; then
		pass "No orphaned canonical subagents"
	else
		warn "Canonical subagent(s) on disk but not in .agents/agentic.json:"
		for o in $orphans; do
			echo "       - $o"
		done
		echo "       Run ./.agents/bootstrap.sh prune to clean up, or restore the entry in .agents/agentic.json."
	fi

	section "Init Validation"
	# The /init completion gate. Detects:
	#   - scaffold metadata leaked into subagents[] (_lifecycle, _intent, category)
	#   - sub-agents missing required fields (name, mode, description, role_file, permission)
	#   - role_file pointing to a non-existent file
	#   - leftover scaffolds (_template_subagents_examples[]) on a non-fresh install
	# This is INFORMATIONAL on first run (init may not have been run yet).
	# Once /init has been run, this MUST be green.
	init_json=$(python3 ./.agents/adapters/_common/render.py --validate-init --root "$(pwd)" 2>/dev/null)
	init_rc=$?
	if [ $init_rc -eq 0 ] && [ -n "${init_json}" ]; then
		pass "/init completion gate: manifest is shaped correctly"
	else
		init_state=$(echo "${init_json}" | python3 -c "import sys, json; print(json.load(sys.stdin).get('state','?'))" 2>/dev/null || echo "?")
		if [ "${init_state}" = "FRESH" ] || [ "${init_state}" = "EMPTY" ]; then
			info "/init has not been run yet (state: ${init_state}). The agent should run /init to shape the manifest."
		else
			fail "/init completion gate: state=${init_state} — the manifest is not correctly shaped. Run /init (or ./.agents/bootstrap.sh init --validate) for details."
			echo "${init_json}" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for e in d.get('errors', []):
        print(f'       ERROR: {e}')
    for w in d.get('warnings', []):
        print(f'       WARN:  {w}')
except Exception:
    pass
" 2>/dev/null
		fi
	fi
fi

# ── SDD Infrastructure check ──────────────────────
section "SDD Infrastructure"
if [ -f "DESIGN.md" ]; then
	pass "Exists DESIGN.md (Global Architecture)"
else
	warn "Missing DESIGN.md in root directory"
fi

for f in specs/README.md specs/templates/requirements.md specs/templates/design.md specs/templates/tasks.md; do
	if [ -f "$f" ]; then
		pass "Exists $f"
	else
		warn "Missing $f"
	fi
done

if [ -f ".agents/agentic.json" ]; then
	pass "Exists .agents/agentic.json (canonical manifest)"
	if python3 -c "import json; json.load(open('.agents/agentic.json'))" 2>/dev/null; then
		pass ".agents/agentic.json is valid JSON"
	else
		fail ".agents/agentic.json is NOT valid JSON"
	fi
else
	fail "Missing .agents/agentic.json — this is the canonical manifest"
fi

if [ -f ".agents/bootstrap.sh" ]; then
	pass "Exists .agents/bootstrap.sh (adapter renderer)"
else
	warn "Missing .agents/bootstrap.sh"
fi

if [ -f ".agents/BOOTSTRAP.md" ]; then
	pass "Exists .agents/BOOTSTRAP.md (LLM fallback for unknown CLIs)"
else
	warn "Missing .agents/BOOTSTRAP.md"
fi

# ── Summary ─────────────────────────────────────────
section "Result"
if [ "$EXIT_CODE" -eq 0 ]; then
	echo "  ${C_GREEN}✅ All checks passed — environment ready${C_RESET}"
else
	echo "  ${C_RED}❌ Some checks failed — resolve before continuing${C_RESET}"
fi
echo ""
exit "$EXIT_CODE"
