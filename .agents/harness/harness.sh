#!/bin/bash
# harness.sh — CLI para enrutamiento y checks del Harness SDD
#
# Uso: ./harness.sh [comando] [argumento]
#
# Comandos:
#   route    — Clasifica y enruta una tarea al agente apropiado
#   check    — Ejecuta check.sh
#   status   — Muestra estado del proyecto (feature activa, specs pendientes)
#   help     — Muestra esta ayuda

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"

help() {
	cat <<'EOF'
Uso: ./harness.sh [comando] [argumento]

Comandos:
  route "descripción de la tarea"
      Clasifica la tarea y muestra los agentes recomendados.

  check
      Ejecuta check.sh en la raíz del proyecto.

  status
      Muestra el estado actual del proyecto:
      - Feature activa (in_progress)
      - Specs pendientes (spec_ready)
      - Últimas entradas de progress/progress.md

  subagents
      Lista los subagentes definidos en .agents/subagents/*/SUBAGENT.md

  help
      Muestra esta ayuda.
EOF
}

route() {
	local task="$*"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo "  Task Routing — Harness SDD"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo ""
	echo "  Task: $task"
	echo ""

	# Keywords para clasificación
	local lower_task
	lower_task=$(echo "$task" | tr '[:upper:]' '[:lower:]')

	if echo "$lower_task" | grep -qE "spec|sdd|requirements|design|tasks?$|ears|feature_list"; then
		echo "  [Classification] SDD Spec Task"
		echo "  [Primary Agent]  spec_author (quality-agent)"
		echo "  [Action]         Create specs/<feature>/{requirements,design,tasks}.md"
		echo "  [Gate]           Mark spec_ready → WAIT for human approval"
	elif echo "$lower_task" | grep -qE "implement|code|build|create|add feature"; then
		echo "  [Classification] SDD Implementation"
		echo "  [Primary Agent]  implementer (orquestador / platform-engineer)"
		echo "  [Secondary]      tester-agent + quality-agent"
		echo "  [Action]         Follow specs/<feature>/tasks.md → check.sh → done"
	elif echo "$lower_task" | grep -qE "terraform|infra|cloud|aws|gcp|azure|vpc|cluster|eks|aks|gke"; then
		echo "  [Classification] Infrastructure / IaC"
		echo "  [Primary Agent]  cloud-architect + platform-engineer"
		echo "  [Secondary]      quality-agent + tester-agent"
	elif echo "$lower_task" | grep -qE "test|coverage|verify|validation"; then
		echo "  [Classification] Testing"
		echo "  [Primary Agent]  tester-agent"
		echo "  [Secondary]      quality-agent"
	elif echo "$lower_task" | grep -qE "security|compliance|policy|audit|soc2|hipaa"; then
		echo "  [Classification] Security / Compliance"
		echo "  [Primary Agent]  security-reviewer"
		echo "  [Secondary]      quality-agent"
	elif echo "$lower_task" | grep -qE "docs|readme|handoff|runbook|document|progress"; then
		echo "  [Classification] Documentation"
		echo "  [Primary Agent]  escriba"
		echo "  [Secondary]      quality-agent"
	else
		echo "  [Classification] General"
		echo "  [Primary Agent]  quality-agent"
		echo "  [Secondary]      (depends on specifics)"
	fi

	echo ""
	echo "  [Config]         $HARNESS_DIR/ROUTING.md"
	echo "  [Workflows]      $HARNESS_DIR/workflows.md"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

status() {
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo "  Project Status — Harness SDD"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo ""

	if [ -f "$ROOT_DIR/feature_list.json" ]; then
		python3 - "$ROOT_DIR/feature_list.json" <<'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

features = data.get('features', [])
print(f"  Project: {data.get('project', 'Unknown')}")
print(f"  Total features: {len(features)}")
print()

in_progress = [f for f in features if f['status'] == 'in_progress']
spec_ready = [f for f in features if f['status'] == 'spec_ready']
pending = [f for f in features if f['status'] == 'pending']
done = [f for f in features if f['status'] == 'done']
blocked = [f for f in features if f['status'] == 'blocked']

print(f"  🟢 done:        {len(done)}")
print(f"  🔵 in_progress: {len(in_progress)}")
if in_progress:
    for f in in_progress:
        print(f"                  {f['id']}: {f['name']} ({f['title']})")
print(f"  🟡 spec_ready:  {len(spec_ready)}")
if spec_ready:
    for f in spec_ready:
        print(f"                  {f['id']}: {f['name']}")
print(f"  ⚪ pending:     {len(pending)}")
print(f"  🔴 blocked:     {len(blocked)}")
if blocked:
    for f in blocked:
        print(f"                  {f['id']}: {f['name']}")
PYEOF
	else
		echo "  feature_list.json not found"
	fi

	echo ""
	if [ -f "$ROOT_DIR/progress/progress.md" ]; then
		echo "  Latest progress entries:"
		head -5 "$ROOT_DIR/progress/progress.md"
	fi
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

subagents() {
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo "  Sub-Agents — Harness SDD"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo ""
	local count=0
	for dir in "$ROOT_DIR/.agents/subagents/"*/; do
		if [ -f "${dir}SUBAGENT.md" ]; then
			name=$(basename "$dir")
			desc=$(head -5 "${dir}SUBAGENT.md" | grep 'description:' | sed 's/description: "//;s/"$//')
			echo "  ✅ $name"
			echo "     $desc"
			echo "     ${dir}SUBAGENT.md"
			echo ""
			count=$((count + 1))
		fi
	done
	if [ "$count" -eq 0 ]; then
		echo "  ⚠️  No se encontraron subagentes en .agents/subagents/"
	fi
	echo "  Total: $count subagentes"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

case "${1:-help}" in
	route) shift; route "$@" ;;
	check) cd "$ROOT_DIR" && exec ./check.sh ;;
	status) status ;;
	subagents) subagents ;;
	help|--help|-h) help ;;
	*) echo "Comando desconocido: $1"; help; exit 1 ;;
esac
