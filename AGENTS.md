# AGENTS.md — Navigation map for agents

> Entry point for any agent in this repository. It is a **map**, not a manual:
> load a linked file only when the task needs it. Keep this file under 8 KB —
> it is read every session.

## §0 — Framework bootstrap (once per clone)

If your CLI's adapter exists, skip to §1.

| CLI | Adapter in the repository root |
|---|---|
| opencode | `opencode.json` |
| gemini-cli | `GEMINI.md`, `.gemini/commands/` |
| claude-code | `CLAUDE.md`, `.claude/` |
| cursor | `.cursor/rules/harness-sdd.mdc`, `.cursor/commands/harness-*.md` |
| codex | `AGENTS.md` (native entry, nothing generated) |

If it is missing: run `./.agents/bootstrap.sh <your-cli>`, tell the user to
restart the CLI, and stop. For a CLI without a prebuilt adapter, follow
`.agents/BOOTSTRAP.md`.

## §0.5 — Project profiling (once per project)

If `./.agents/bootstrap.sh brief` reports `init: FRESH` or `init: PARTIAL`, run
`/init` (body: `.agents/commands/init.md`) before feature work. It is complete
only when `./.agents/bootstrap.sh init --validate` and `./check.sh` exit 0.
Later additions use `add-agent`, `add-steering`, `add-hook`; details are in
`docs/framework-workflow.md` ("Template Installation Lifecycle").

## §1 — Session start (mandatory, two commands)

1. `./check.sh --quiet` — prints only warnings, failures, and the result. If it
   fails, stop and fix the environment first.
2. `./.agents/bootstrap.sh brief` — active feature, its next task, features
   awaiting approval, `progress/current.md`, and context-budget warnings.

Do **not** read `feature_list.json`, `progress/progress.md`,
`progress/history.md`, or `progress/handoff.md` in full: they grow with the
project and the brief already carries what a session needs. Then load only
what the task requires (§2).

## §2 — Repository map (read on demand)

| Path | Read it when |
|---|---|
| `.kiro/specs/<feature>/{requirements,design,tasks}.md` (or `specs/<feature>/`) | Working on that feature |
| `DESIGN.md` | Writing or reviewing a design, or changing architecture |
| `docs/sdd.md`, `specs/README.md`, `specs/templates/` | Writing a spec (`/spec`) |
| `.agents/commands/<name>.md` | The user invokes that slash command |
| `.agents/subagents/<role>/SUBAGENT.md`, `SOUL.md` | Acting in that role |
| `.agents/skills/<name>/SKILL.md` | The task matches the skill's frontmatter description |
| `.kiro/steering/`, `.kiro/hooks/`, `hooks/` | Changing agent directives or lifecycle automation |
| `docs/workflow-contract.md`, `docs/team-policy.md` | The project declares `team_policy`, or a gate fails |
| `docs/framework-customization.md`, `docs/quality-checks.md` | Adapting `check.sh` or the manifest |
| `.agents/agentic.json`, `.agents/adapters/<cli>/` | Changing agents, skills, commands, or adapters |
| `progress/history.md`, `progress/decisions.md` | A past decision is needed: search them, do not read them whole |
| `feature_list.json` | Adding a feature: append an entry, do not rewrite the file |

## §3 — Hard rules

- One feature `in_progress` at a time (unless team policy raises the limit).
- `sdd: true` features: spec → **human approval** → implement → review → done.
  Stop at `spec_ready` and wait. Never approve on your own initiative.
- Never edit an approved spec; only `[x]` markers in `tasks.md` change.
- Every `R<n>` ends with at least one test.
- No feature is `done` unless `./check.sh` exits 0.
- Change feature status only through `./.agents/bootstrap.sh workflow-transition`.
  Do not edit `status` in `feature_list.json` by hand to pass a gate.
- Never edit generated adapters (`opencode.json`, `GEMINI.md`, `CLAUDE.md`,
  `.claude/`, `.gemini/`, `.cursor/`). Edit `.agents/agentic.json` and re-render.
- `.agents/agentic.json#subagents[]` is the source of truth for active
  sub-agents; removing a canonical one prunes its directory on the next render.

## §4 — Workflow (SDD)

```
pending → /spec → spec_ready → ⏸ human → /approve → in_progress → /implement → /done → done
```

Each slash command has its steps in `.agents/commands/<name>.md`; read that
body when the command is invoked, not before. `/status` shows the brief.

## §5 — Session closing

1. `./check.sh --quiet` passes.
2. Rewrite `progress/current.md` with the live state only: active task, what
   is done, blockers, next step. Keep it under 3 KB; replace, do not append.
3. When a task or feature finishes, append a summary of at most five lines to
   `progress/history.md` and reset `progress/current.md` to its template.
4. If the brief reports a progress log over budget, run
   `./.agents/bootstrap.sh archive-log progress/<file>.md`.
5. Leave no temporary files, debug output, or TODOs without context.

## §6 — Repository stack

| Layer | Technology |
|---|---|
| Languages | TypeScript (VS Code extension) |
| Build / CI | esbuild, GitHub Actions |
| Validation | vitest, `npm run test:integration` |

## §7 — Sub-agents

Active roles are listed in `.agents/agentic.json#subagents[]` and in your CLI's
generated adapter. The canonical scaffolds are `harness` (orchestrator),
`spec-author`, `implementer`, and `reviewer`; copy
`.agents/subagents/agent-template/` to create another. Roles named in
`.agents/harness/ROUTING.md` are illustrative until scaffolded.

## §8 — CLI-agnostic integration and skills

`.agents/agentic.json` is the single source of truth. `./.agents/bootstrap.sh
<cli>` renders it into each CLI's native files, which are generated and
git-ignored; `./.agents/bootstrap.sh --check` detects drift. To add a CLI, see
`docs/framework-customization.md`.

Skills: load in full the skills a role lists under `## Skills` in its
`SUBAGENT.md`. For the rest, read only the YAML frontmatter of
`.agents/skills/*/SKILL.md` and load a skill when its description matches the task.
