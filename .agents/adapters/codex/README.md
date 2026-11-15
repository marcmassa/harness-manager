# codex adapter

Codex (OpenAI) adopts the Harness SDD framework through files it already
reads natively. This adapter is deliberately thin: it renders **no** files
and verifies the native integration instead.

## How it is rendered

`./.agents/bootstrap.sh codex` reads `.agents/agentic.json`, applies
`project_detect` rules, verifies the native contract below, and prints the
integration summary. No LLM is involved.

## Native contract (verified 2026-10-22 against learn.chatgpt.com/codex docs)

| Harness element | Codex native mechanism | Action |
|---|---|---|
| Entry instructions | `AGENTS.md` (read automatically by Codex CLI) | **Never rendered, never overwritten, never deleted** — it is versioned source |
| Skills | `$REPO_ROOT/.agents/skills` — Codex scans `.agents/skills` from CWD to repo root (REPO scope) | Read natively; no copy, no symlink |
| Commands | Custom prompts are **deprecated** and live in `~/.codex/prompts` (user-level, "not shared through your repository"); the official recommendation is skills | **Not emitted** |
| Lifecycle hooks | Codex has no project-level tool-transition hook file equivalent to the SDD transition points | Bridge via `AGENTS.md` workflow steps + `hooks/run-hooks.sh` invocations already documented in the workflow bodies |
| Permissions | Codex has no project file-ACL concept | `permission.edit` from the manifest is documentation, not enforcement |

## Why nothing is generated

`.codex/prompts/harness-*.md` was considered (R6) and rejected on evidence:
the custom-prompts mechanism is deprecated in favor of skills, and was never
project-level. Emitting deprecated user-level files would put framework
content outside the repository, breaking the "the repo IS the system"
principle. If Codex ships project-level prompts or a hooks file with SDD
equivalents in the future, this adapter gains those outputs — the
`RENDERERS` entry is already registered.

## What a Codex user actually gets

1. Codex launches in the repo and reads `AGENTS.md` — the SDD contract,
   workflow commands, and role model are in context.
2. Skills in `.agents/skills/*/SKILL.md` appear in the `$` skill picker and
   match implicitly by description (cross-CLI SKILL.md standard).
3. Running a workflow means asking Codex to follow one of the commands
   documented in `AGENTS.md` — e.g. "run the /spec workflow" → Codex reads
   `.agents/commands/spec.md` and executes it, including the
   `hooks/run-hooks.sh` transition points.

## Caveats and limitations

- No slash-command parity with Claude Code/Cursor: Codex custom prompts are
  user-level and deprecated. Workflows are invoked by instruction, not by
  native slash commands.
- Skills discovery depends on launching Codex inside the repository
  (REPO scope) — launching from a parent directory requires CWD inside the
  repo.
