# Current Session State

## Active Feature
**FEAT-031 — Advisory Live Sync & Re-scan** — `spec_ready`

Spec completo en `.kiro/specs/advisory-live-sync/` (requirements, design, tasks). Listo para implementar. T1–T6 son Fase 1 (botón Re-scan, independientemente shippable). T7–T22 son Fase 2 (bus de estado compartido).

---

## FEAT-031 — Design Summary

### Por qué existe
El Advisory panel opera en una burbuja aislada:
- Evalúa solo el filesystem, sin conocer el estado en memoria del whiteboard ni la lista de features.
- No hay botón de re-scan en el webview — solo en el tree view de VS Code.
- El nivel de madurez (L0–L5) solo es visible si el usuario navega al tab Advisory.
- El dismissal de sugerencias tiene dos caminos de escritura duplicados.

### Qué hace Phase 1 (T1–T6)
- Añade `'rescanAgentic'` a `WebviewMessageType`
- `AdvisoryCoordinator.handle()` maneja el mensaje → llama `agenticDetector.scan()`
- `AdvisoryPanel.tsx` recibe props `onRescan` + `isScanning`
- `index.tsx` trackea `isAdvisoryScanning`

### Qué hace Phase 2 (T7–T22)
- `GraphContext` (nodos por tipo, features por estado) pasa a cada `scan()` desde el extension host
- Dos nuevas reglas en `advisoryEngine.ts`: S-GC01 (agentes sin skills) y S-GC02 (sprint completo)
- `architectureSummary` broadcast: enviado al inicio y al final de cada scan → `MaturityBadge` en el tab header, visible desde todos los tabs
- `scheduleScan()` en `AgenticDetector` permite a los coordinators pedir un re-scan con debounce 1000ms tras cada write
- `.kiro/specs/**` añadido al file watcher
- Dismissal consolidado en `AgenticDetector.dismissSuggestion()` — elimina estado duplicado

### Archivos nuevos
Ninguno — todos los cambios son modificaciones a archivos existentes.

---

## Último estado del proyecto (pre-FEAT-031)

| Item | Estado |
|------|--------|
| Versión | 0.6.0 |
| Tests | 372 (25 archivos) — todos pasan |
| Build | Limpio |
| `./check.sh` | Verde (build, tests, feature-list, steering, hooks, governance) |
| Adapter drift | Pre-existente (CLAUDE.md / .gemini/ ausentes — pendiente) |
| Features | 30 done / 1 spec_ready (FEAT-031) |

## Historial de versiones
- **v0.6.0** (2026-06-27): FEAT-030 — Tech Debt & Security Hardening
- **v0.5.1** (2026-06-27): Patch de seguridad
- **v0.5.0** (2026-06-20): FEAT-029 — Universal Agentic Architecture Detection & Advisory
- **v0.4.1** (2026-06-18): Layout overhaul
- **v0.4.0**: FEAT-025–028
- **v0.3.0**: FEAT-023
- **v0.1.0–0.2.0**: Foundation → CI/governance
