---
name: dry-principle
description: "Principio DRY (Don't Repeat Yourself) — cada pieza de conocimiento tiene una representación única, autoritativa, dentro del sistema"
applies_to:
  - "*"
---

# DRY — Don't Repeat Yourself

> "Cada pieza de conocimiento — la representación de una idea, un hecho, una restricción — debe tener una representación única, inequívoca y autoritativa dentro del sistema."

## Regla de Oro

**Si el mismo conocimiento aparece en dos lugares, hay un bug latente esperando a que uno de los dos se actualice sin el otro.** DRY no es "no repetir caracteres" — es "no repetir **conocimiento**".

## Cuándo Aplicar

- **Lógica de negocio** duplicada en 2+ sitios: extraer a 1 función, 1 constante, 1 tipo.
- **Schemas/formatos** duplicados: la fuente de verdad debe ser 1 (ej.: `feature_list.json` para features, no un segundo `feature_list.backup.json`).
- **Constantes mágicas** repetidas: extraer a `const` nombradas (ej.: `HANDLE_ACCENT['subagent']` no `'#4a7dff'` repetido en 5 sitios).
- **CSS/estilos** duplicados: tokens en `src/webview/styles.ts`, no valores hardcoded en 10 componentes.

## Cuándo NO Aplicar

- **Test fixtures**: duplicar datos en tests es deseable — cada test debe ser independiente.
- **Documentación**: repetir un ejemplo en README, docstrings y steering es útil (cada uno tiene su audiencia).
- **Interfaces deliberadamente paralelas**: dos `interface` que se parecen pero que evolucionan independientemente (ej.: `HarnessNode` vs `WhiteboardNode` — la primera viene del parser, la segunda es la forma que consume el webview).
- **DRY-violating KISS**: si abstraer añade 2 niveles de indirección para eliminar 3 líneas duplicadas, **no lo hagas** (ver steering KISS).

## Heurísticas Prácticas

| Pregunta | Si la respuesta es "sí" | Acción |
|----------|-------------------------|--------|
| ¿Cambiar esto en un lugar requiere cambiarlo en otro para que funcione? | Sí | Extraer |
| ¿Hay 2+ `if/else` con la misma condición? | Sí | Consolidar |
| ¿El mismo string aparece 3+ veces? | Sí | Constante nombrada |
| ¿El mismo cálculo aparece 2+ veces? | Sí | Helper |
| ¿La duplicación es solo "se parecen" pero cambian por razones distintas? | No | Dejar (son cosas distintas) |

## Anti-Patrones

- **Constantes duplicadas**: `'#4a7dff'` en 5 archivos. Si un día hay que cambiarlo, 5 sitios fallan.
- **Lógica de validación duplicada**: `validateSteering()` en 2 archivos — si cambia la regla, hay que sincronizar.
- **Documentación desactualizada**: la doc dice una cosa, el código hace otra. El conocimiento está duplicado, divergen.
- **Copy-paste de tests**: copiar un test y cambiar 1 línea. El test original evoluciona, la copia queda obsoleta.

## Trade-off Explícito con KISS

DRY y KISS entran en tensión. La regla de desempate:

> **Aplica DRY cuando la duplicación introduce acoplamiento (cambiar uno rompe el otro). Aplica KISS cuando la abstracción introduce más complejidad de la que elimina.**

- 2 funciones idénticas de 5 líneas que probablemente cambien juntas → DRY: extraer.
- 2 funciones idénticas de 50 líneas que cubren dominios distintos → KISS: dejar.

## Ejemplo del Repo

**Antes (DRY violation)**: cada adapter declaraba su propio `style = { stroke: '#4a7dff', ... }` con colores hardcoded.

**Después (DRY fix)**: `EDGE_GLOW_RGB` y `HANDLE_ACCENT` en `src/webview/styles.ts` son la única fuente de verdad. Los adapters importan y consumen.

Ver `src/webview/styles.ts` (FEAT-008, FEAT-016) y `src/types.ts` (NodeType, EdgeLabel unions).

## Referencias

- `steering/kiss-principle.md` — el trade-off explícito entre DRY y KISS
- `steering/typescript-implementer.md` — ejemplos de DRY aplicado a la estructura del proyecto
- `DESIGN.md` — convenciones sobre constantes compartidas
