# Current Session State

## Active Feature
- None (session closed)

## Completed This Session
- FEAT-013 — Skill Toggle & Suggestion Visibility Control — **done**

## Summary
- Bug R7 fixed: `isSuggested`/`isUses` en EdgeContextMenu derivados de `originalLabel`
- Bug R8 fixed: `handleDismissSuggestion` filtra por `originalLabel === 'suggested'`
- Bug R9 fixed: dialog Accept usa `(e.data as any)?.originalLabel === 'suggested'`
- Bug R1/R2 fixed: sugerencias descartadas persisten en `workspaceState` y se excluyen del parser
- Bug R10 fixed: `enrichWithIdoneity` devuelve la matriz; `enrichSuggestedEdgesWithIdoneity` la recibe
- Bug R11 fixed: `acc: Record<string, number>` en `_sendData`
- Bug R12 fixed: overlay transparente cierra menú contextual de nodo
- R3: checkbox "Suggestions" en header filtra aristas suggested del grafo
- R4/R6: botón "Disable / Enable Connection" en EdgeContextMenu
- R5: aristas desactivadas con estilo muted (#6c6c8a, dasharray, opacity 0.45)
- 8 nuevos tests; total 96 tests, todos en verde; `./check.sh` verde

