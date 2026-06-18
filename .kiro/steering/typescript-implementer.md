---
name: typescript-implementer-conventions
description: "Convenciones TypeScript para el implementer — VS Code extension host + React Flow webview"
applies_to:
  - typescript-implementer
---

# Convenciones TypeScript — Implementer

## Estructura del Proyecto

```
src/
├── extension.ts              # Entry point VS Code extension
├── harnessParser.ts           # Parser de agentic.json + subagents
├── semanticMatcher.ts         # TF-IDF + cosine similarity
├── idoneity.ts               # Idoneity scoring
├── adapters/                  # 8+ adapters (Harness, Claude, Gemini, etc.)
└── webview/                   # React Flow + Webview UI
    ├── index.tsx              # Entry point Webview
    ├── components/            # Nodos, edges, paneles
    └── nodePositionUtils.ts   # Persistencia de posiciones
```

## VS Code Extension

- Usar `vscode` API, no APIs de Node.js inseguras.
- Webview messaging: `postMessage` con tipos explícitos.
- Extension context: usar `context.subscriptions` para disposables.
- NUNCA bloquear el extension host (operaciones asíncronas con `async/await`).

## React + React Flow

- Componentes funcionales con `React.FC<Props>` o interfaces explícitas.
- Nodos React Flow: usar `useCallback` para handlers, `useMemo` para datos derivados.
- No efectos secundarios en render — usar `useEffect` con cleanup.
- CSS modules o `styles.ts` con objetos tipados (no inline styles masivos).

## Testing

- Vitest: `npm test -- --run` (126 unit tests existentes).
- @vscode/test-electron: 1 integration test.
- Table-driven tests para parsers y matchers.
- Mockear `vscode` API con `vi.mock()`.

## Anti-Patrones

- No usar `any` sin justificación documentada en `progress/decisions.md`.
- No importar `vscode` en código del Webview (contextos separados).
- No hacer fetch HTTP — el plugin es puramente client-side.
- No usar `eval()` o `new Function()` con input de usuario.
