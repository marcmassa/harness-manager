# Kiro Minimal Fixture (FEAT-023)

A minimal Kiro workspace used by `KiroAdapter.test.ts` (R15).

## Layout

```
.kiro/
  agents/demo-agent.md         # H1 + body + "## Skills" section referencing demo-skill (R12)
  skills/demo-skill/SKILL.md   # Frontmatter + body
  README.md                    # This file.
```

## Custom-path test (R15)

The custom-path test (in `KiroAdapter.test.ts`) configures the
registry to use a non-default path and seeds the workspace with
a directory at that path. The test verifies the adapter finds
the seeded file via the registry, not the hardcoded default.

This avoids creating a second fixture workspace on disk: the
test seeds its custom-path data in the same `kiro-minimal/`
workspace and clears it in `afterEach`.
