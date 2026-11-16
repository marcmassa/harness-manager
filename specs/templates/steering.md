# Steering File Template

> Copia este archivo a `steering/<name>.md` y personaliza el frontmatter YAML y el cuerpo.
> Declara el archivo en `.agents/agentic.json#steering[]` o usa `./.agents/bootstrap.sh add-steering`.

## YAML Frontmatter

```yaml
---
name: <unique-name>
description: "<breve descripción de qué contiene y para qué sirve>"
applies_to:
  - "*"            # "*" = global, o lista de nombres de sub-agentes
---
```

## Secciones sugeridas

### Contexto

Describe el contexto específico del proyecto o del rol al que aplica este steering file.

### Reglas

1. Regla concreta y accionable que el agente debe seguir.
2. Cada regla debe ser verificable (¿cómo saber si el agente la cumplió?).

### Convenciones

- Convención de nombrado, estructura, o estilo que el agente debe respetar.

### Anti-patrones

- Patrón o enfoque que el agente NO debe usar, con la razón.

### Referencias

- `AGENTS.md` — mapa de navegación del repositorio.
- `DESIGN.md` — arquitectura global.
- `specs/<feature>/design.md` — diseño del feature activo.
