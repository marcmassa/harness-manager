# cursor adapter

This adapter renders the canonical manifest `.agents/agentic.json` into
Cursor-native project files, so Cursor adopts the Harness SDD framework
without LLM translation.

## How it is rendered

`./.agents/bootstrap.sh cursor` (or equivalently,
`./.agents/adapters/_common/render.py --cli cursor --root .`) reads
`.agents/agentic.json`, applies `project_detect` rules, and produces the
files below deterministically. No LLM is involved.

## Output paths

| Path | Content |
|---|---|
| `.cursor/rules/harness-sdd.mdc` | Project rule (frontmatter `description` + `alwaysApply: true`): SDD hard rules, role pointers, workflow commands |
| `.cursor/commands/harness-<name>.md` | One per manifest command; body stub → read `body_file` and execute the workflow |

Generated files are gitignored (see the repo `.gitignore`); regenerate with
`./.agents/bootstrap.sh cursor`. Verify drift with
`./.agents/bootstrap.sh cursor --check`.

## Field mapping (`.agents/agentic.json` → Cursor)

| Manifest | Cursor | Notes |
|---|---|---|
| `subagents[*].name/mode/description/role_file` | rule body, `## Roles` section | Stub: "read that file FIRST and follow it strictly" |
| `commands[*].name` | `.cursor/commands/harness-<name>.md` | `harness-` prefix — never overwrites user commands |
| `commands[*].description` | command frontmatter `description` | Direct copy |
| `commands[*].body_file` | command body | "Read <body_file> and execute the workflow described there" |
| `steering[]` (global) | rule body source conventions | Global steering also lands in the rule; per-agent steering is documented in the rule's role sections |

## Lifecycle hooks — bridge decision (verified 2026-10-22)

Cursor supports `.cursor/hooks.json` with tool- and session-scoped events
(`sessionStart`, `preToolUse`, `beforeShellExecution`, `beforeFileEdit`,
`stop`, `afterAgentResponse`, … — full list at cursor.com/docs/hooks).

**The SDD hook events are command-transition driven** (`on_spec_created`,
`on_spec_approved`, `on_implementation_start/complete`, `on_review_start/complete`,
`on_feature_done`, `on_check_pass`). **No Cursor hook event has a genuine 1:1
SDD equivalent**, so this adapter deliberately does NOT emit `hooks.json`.

The bridge is the command bodies: each generated command instructs the agent
to run `hooks/run-hooks.sh <event>` at the transition points the workflow
body indicates — the same mechanism Claude Code and Gemini CLI adapters use.

If a future Cursor event maps cleanly to an SDD transition (e.g. a
command-invocation hook), emit `.cursor/hooks.json` here and keep the
invocation as `hooks/run-hooks.sh <event>`.

## Caveats and limitations

- Cursor reads `AGENTS.md` natively; the rule file adds the SDD-specific
  contract on top (hard rules, roles, command index).
- Cursor has no native permissions model — `permission.edit` from the
  manifest is documented behavior in the rule, not a hard ACL. This mirrors
  the Gemini CLI adapter's soft-permission caveat.
- The `harness-` command prefix could collide with a user file literally
  named `harness-<cmd>.md`; accepted and documented (negligible risk).
- The rule uses `alwaysApply: true` so the SDD contract is always in
  context. Trim the body if your project needs the context budget.
