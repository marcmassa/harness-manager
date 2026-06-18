---
name: global-conventions
description: "Convenciones globales del VS Code plugin Harness Dashboard — TypeScript, React Flow, Webview"
applies_to:
  - "*"
---

# Convenciones Globales — Harness Dashboard

## Contexto

**Harness Dashboard** es un plugin de VS Code que visualiza arquitecturas de agentes IA.
- TypeScript 5.3.3+, `strict: true`, ES modules.
- React 18 + React Flow 11.11.4 (Webview UI).
- 4 sub-agents especializados, 7 skills sincronizados, 23 features completados.
- Sin backend: todo es client-side (VS Code Extension Host + Webview).

## Sub-Agentes Activos

| Agente | Rol | Scope |
|--------|-----|-------|
| `harness-vscode` | Orchestrator — gestiona feature_list.json, rutea tareas | Global |
| `spec-author-vscode` | EARS specs — VS Code API, UX interactions | `specs/**`, `progress/**` |
| `typescript-implementer` | TypeScript implementer — extension host + webview | `src/**`, `*.ts`, `*.tsx` |
| `reviewer-vscode` | Reviewer — R<n> ↔ test traceability, check.sh | `progress/**`, `feature_list.json` |

## Reglas Obligatorias

1. NUNCA modificar specs aprobados (`specs/<feature>/{requirements,design,tasks}.md`).
2. NUNCA editar adapters generados (`opencode.json`, `GEMINI.md`, etc.) — edita `agentic.json`.
3. SIEMPRE ejecutar `./check.sh` antes de declarar `done`.
4. Un feature a la vez en `in_progress`.
5. Cada R<n> debe tener ≥ 1 test.
6. Sin llamadas HTTP externas: el plugin es puramente client-side.

## Referencias

- `DESIGN.md` — arquitectura global y principios
- `AGENTS.md` — guía completa de navegación
- `progress/decisions.md` — ADR-001 (SDD), ADR-002 (repo name), ADR-003 (Windsurf)
