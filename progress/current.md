# Current Session State

## Active Feature
Ninguna. Todos los features en `feature_list.json` están en `done`.

---

## Última sesión completada — FEAT-030 Tech Debt & Security Hardening (2026-06-27)

### Resumen
Release de calidad interna v0.6.0. Sin cambios de API ni de comportamiento visible para el usuario. 372 tests, build limpio, `./check.sh` verde en build/tests/feature-list.

### Qué se hizo

#### Seguridad (R1–R6)
- **CSP nonce**: `_getWebviewHtml()` genera un nonce criptográfico por render via `globalThis.crypto.getRandomValues`. Header: `script-src 'nonce-...'` sin `unsafe-inline`.
- **Sandbox**: `allow-same-origin` eliminado de sidebar `WebviewView` y full-window `WebviewPanel`.
- **Message guard**: `isKnownWebviewMessage()` type guard con unión `WebviewMessageType` (28 tipos) y `Set` `KNOWN_MESSAGE_TYPES`. Mensajes desconocidos → `log.warn` + return.

#### Coordinadores (R7–R9)
Tres clases en `src/coordinators/`:

| Clase | Casos | Helpers propios |
|-------|-------|----------------|
| `WhiteboardCoordinator` | 13 (createNode, deleteNode, updateMetadata, createEdge, deleteEdge, confirmAndDeleteEdge, getMarkdownContent, openMarkdownFile, acceptSuggestion, dismissSuggestion, reassignSkill, updateEdgeLabel, toggleSkillConnection) | `_shouldUseCustomEdgeFallback`, `_upsertCustomUsesEdge`, `_removeCustomUsesEdge`, `_deleteEdgeWithFallback` |
| `SddCoordinator` | 10 (getFeatureList, getSpecFile, saveSpecFile, generateWithAI, createSpecFile, generateSpecDraft, openInEditor, createFeature, generateFeatureDescription, deleteFeature) | todos los helpers SDD |
| `AdvisoryCoordinator` | 2 (dismissAgenticSuggestion, applyHarnessSDD) | `_applyHarnessSDD` |

`_handleWebviewMessage` en `extension.ts`: 45 líneas, cadena coordinators. Retiene solo `ready`, `getData`, `openFullWindow`, `openSettings`.  
`setupCodeQualityVerifier` extraído a `src/verifier/codeQualitySetup.ts`.  
Resultado: **340 líneas ejecutables** en `extension.ts` (objetivo ≤ 400).

#### Descomposición FeatureSpecPanel (R10–R11)
Monolito de 1 994 líneas → 5 archivos:

| Archivo | Líneas | Responsabilidad |
|---------|--------|----------------|
| `FeatureSpecPanel.tsx` | 192 | Estado de la lista, routing de mensajes, layout exterior |
| `FeatureList.tsx` | 221 | Sidebar con `FeatureCard`, `StatusBadge`, `PriorityBadge` |
| `SpecEditor.tsx` | 314 | Cabecera de feature, tab strip, contenido edit/view |
| `AiAssistBar.tsx` | 96 | Barra de acciones (Create / Edit / Generate with AI) |
| `SpecWizard.tsx` | 372 | Wizard de generación de specs en 5 pasos |

Todos los 4 archivos listados en el requisito: ≤ 600 líneas ✓.

#### Tipos (R12–R13)
- `NodeMetadata` = unión discriminada de 7 interfaces tipadas con `[key: string]: unknown`.
- `HarnessNode.metadata` ya no es `Record<string, any>`.
- `_handleWebviewMessage` recibe `data: unknown`; accesos con casts explícitos `as string`.

#### Dependencias / docs (R14–R15)
- `dagre` + `@types/dagre` → `devDependencies`.
- `DESIGN.md` §4 y §6: referencias a `gray-matter` corregidas.

#### Tests (R16–R17)
- `src/webview/layoutUtils.test.ts` — 6 tests.
- `src/messageDiscriminator.test.ts` — 8 tests.
- Total: **372 tests** (25 archivos, todos pasan).

---

## Estado del proyecto

| Item | Estado |
|------|--------|
| Versión | 0.6.0 |
| Tests | 372 (25 archivos) — todos pasan |
| Build | Limpio |
| `./check.sh` | Verde (build, tests, feature-list, steering, hooks, governance) |
| Adapter drift | Pre-existente (CLAUDE.md / .gemini/ ausentes — no relacionado con FEAT-030) |
| Features done | 30/30 en `feature_list.json` |

## Historial de versiones
- **v0.6.0** (2026-06-27): FEAT-030 — Tech Debt & Security Hardening
- **v0.5.1** (2026-06-27): Patch de seguridad (CVEs, eliminación gray-matter)
- **v0.5.0** (2026-06-20): FEAT-029 — Universal Agentic Architecture Detection & Advisory
- **v0.4.1** (2026-06-18): Layout overhaul, specs discovery fix
- **v0.4.0**: FEAT-025–028 (SDD panel, code quality hooks, cross-framework discovery, AI universal)
- **v0.3.0**: FEAT-023 (ConfigurationRegistry, Kiro adapter)
- **v0.1.0–0.2.0**: Foundation → CI/governance/E2E tests

## Próximos pasos sugeridos
1. **Adapter drift** — ejecutar `./.agents/bootstrap.sh claude` para regenerar `CLAUDE.md` y `.claude/agents/`.
2. **Smoke test manual** — abrir en VS Code con un workspace Harness SDD real, verificar que el whiteboard, SDD panel y Advisory tab funcionan con los nuevos sub-componentes.
3. **Publicar v0.6.0** — etiquetar `v0.6.0` para disparar el workflow `publish.yml` y generar el VSIX.
