---
name: kiss-principle
description: "Principio KISS (Keep It Simple, Stupid) — preferencia por soluciones simples sobre abstracciones prematuras"
applies_to:
  - "*"
---

# KISS — Keep It Simple, Stupid

> "La mayoría de sistemas funcionan mejor si se mantienen simples en vez de complicados. Por eso la simplicidad debe ser un objetivo clave del diseño."

## Regla de Oro

**Si una sola función, archivo o interfaz resuelve el problema, no abstraigas prematuramente.** Cada capa de indirección tiene un costo: hay que leerla, mantenerla, testearla, y explicar qué hace. Solo se justifica cuando la abstracción resuelve un problema real, concreto y presente.

## Cuándo Aplicar

- **Diseño de features**: preferir 1 función con 1 loop sobre 3 funciones con 3 interfaces.
- **Configuración**: preferir 3 settings bien elegidos sobre 10 settings granulares.
- **APIs públicas**: preferir 1 método que hace lo correcto sobre 2 métodos que requieren que el caller elija.
- **Tests**: preferir tests cortos y obvios sobre helpers de test reutilizables.

## Cuándo NO Aplicar

- Cuando la duplicación introduce **inconsistencia** (ver DRY steering).
- Cuando el dominio es genuinamente complejo (parsers, state machines) y la simplicidad oculta la semántica.
- Cuando el equipo ya entiende la abstracción (ej.: `ConfigurationRegistry.getInstance()` es un singleton, todos lo conocen).

## Heurísticas Prácticas

| Pregunta | Si la respuesta es "sí" | Acción |
|----------|-------------------------|--------|
| ¿Puedo resolver esto en 1 función en vez de 3? | Sí | Combinar |
| ¿Esta abstracción tiene 2+ consumidores hoy? | No | Inline |
| ¿El lector necesita leer 2 archivos para entender esto? | Sí | Simplificar |
| ¿El nombre de esta clase/función tiene más de 4 palabras? | Sí | Renombrar o partir |
| ¿Hay una sección de "Discarded alternatives" más larga que la solución? | Sí | Reescribir |

## Anti-Patrones

- **Orquestador de orquestadores**: una función cuya única responsabilidad es llamar a otras funciones, sin lógica propia.
- **Interface de un solo uso**: declarar una `interface` o tipo abstracto que solo implementa una clase concreta.
- **Configuración con valores que nadie cambia**: 7 settings cuando 3 resuelven el 95% de los casos.
- **Helper que no se reutiliza**: funciones helper creadas "por si acaso" en un archivo `utils.ts` que termina con 50 funciones.

## Ejemplo del Repo

**Antes (anti-KISS)**: 7 settings de configuración, 3 interfaces, 5 helpers para resolver el globs paths.

**Después (KISS)**:
- 3 settings globales
- 1 archivo JSON local para overrides
- 1 función `discover()` con 1 loop

Ver `specs/cross-framework-hooks-steering/` (FEAT-026) para el caso completo.

## Referencias

- `steering/typescript-implementer.md` — convenciones TS que aplican KISS
- `DESIGN.md` — sección "Architectural principles"
- `progress/decisions.md` — ADRs que documentan trade-offs de simplicidad
