# Harness SDD — Bootstrap (LLM Fallback for Unknown CLIs)

> This file is read by an LLM-driven agent only when the user's CLI has **no prebuilt adapter** under `.agents/adapters/<cli>/` and `./.agents/bootstrap.sh detect` reports "unknown CLI".
>
> If a prebuilt adapter exists, the deterministic `./.agents/bootstrap.sh <cli>` script is the preferred path. Do not use LLM translation in that case.

---

## What you are doing

The user has opened this repository in an agentic CLI that the Harness SDD template
does not ship a prebuilt adapter for. Your job is to translate the canonical
manifest at `.agents/agentic.json` into whatever native config format your CLI
expects, and to write the resulting file(s) wherever your CLI scans.

## Observe first (mandatory)

Before generating anything:

1. Run `./.agents/bootstrap.sh detect --clis` and read the evidence JSON.
2. Propose a `target_clis` list to the human (default: the CLIs whose
   generated paths exist; `opencode` if none). Include CLIs without a
   prebuilt adapter (e.g. `cursor`) — the LLM fallback handles them.
3. Confirm the list with the human via prompt. Do not assume.
4. Write the confirmed list to `agentic.json#target_clis` and run
   `./.agents/bootstrap.sh clean` to delete generated adapters of CLIs
   that are not in the list.

Generate files only for the CLI in use. Never leave adapters for CLIs the
human did not confirm.

## Steps

1. **Read the canonical manifest.**
   Open `.agents/agentic.json` and internalize its structure: `instructions`,
   `skills`, `default_agent`, `target_clis`, `subagents`, `steering`, `hooks`,
   `commands`, `project_detect`. Note that `_template_subagents_examples[]`,
   `_template_steering_examples[]`, and `_template_hooks_examples[]` are
   **scaffolds** — patterns, not active definitions. Only arrays without the
   leading underscore (`subagents[]`, `steering[]`, `hooks[]`) are active
   and must be translated.

2. **Read the reference examples.**
   Inspect at least one prebuilt adapter for inspiration:
   - `.agents/adapters/opencode/README.md` (field mapping reference)
   - Optionally `.agents/adapters/claude-code/` and `.agents/adapters/gemini-cli/`

   > **Note**: opencode is rendered **programmatically** by `render_opencode()`
   > in `.agents/adapters/_common/render.py` (no `.tmpl` file is processed).
   > Inspect the Python function for the canonical output shape.

3. **Detect your project stack.**
   Inspect the repo for: `**/*.tf`, `pyproject.toml`, `setup.py`, `requirements.txt`,
   `go.mod`, `package.json`, etc. Note any `project_detect` matches in
   `agentic.json` so you can apply the stack-aware permission overrides.

4. **Translate `subagents` to your CLI's agent concept.**
   For each subagent in `agentic.json`:
   - Create the equivalent of an "agent" / "role" / "system prompt" in your CLI.
   - The agent's system prompt should be a short stub:
     > "You are `<name>`. Your complete role is defined in `<role_file>` — read that file FIRST and follow it strictly."
   - Translate `permission.edit` to your CLI's permission syntax (allow/deny/ask lists, glob patterns, etc.).
   - Honor `mode: primary` (default agent) and `mode: subagent` (delegated role).

5. **Translate `commands` to your CLI's command/macro concept.**
   For each command in `agentic.json`:
   - Create the equivalent slash command / macro / quick action.
   - The command body should be a short stub:
     > "Read `<body_file>` and execute the workflow described there."

6. **Apply `instructions` and `steering` to your CLI.**
   Copy `agentic.json`'s `instructions` array (global) plus every file listed
   in `steering[].file` into your CLI's "system instructions" / "rules" /
   "context" field. If your CLI supports per-agent instructions, steering files
   with `applies_to` targeting specific agents should be assigned to those
   agents. Steering files with `applies_to: ["*"]` are global.

7. **Set up skills.**
   If your CLI has a skill concept, point it at `.agents/skills/` (the canonical
   location). If your CLI cannot discover skills there, symlink or copy the
   skill directories to wherever your CLI expects them.

8. **Map lifecycle hooks.** (optional)
   The SDD workflow has lifecycle hooks declared in `agentic.json#hooks[]`.
   The hook runner is `hooks/run-hooks.sh` — a shell script that any CLI can
   invoke. If your CLI has an event/plugin system, map each hook event
   (`on_spec_created`, `on_feature_done`, etc.) to your CLI's event
   mechanism. If not, document that `hooks/run-hooks.sh <event>` should be
   run at the corresponding SDD workflow transition points.

9. **Write the file(s) to wherever your CLI scans.**
   Examples:
   - opencode → `opencode.json` in repo root
   - gemini-cli → `GEMINI.md` in repo root + `.gemini/commands/<name>.toml`
   - claude-code → `CLAUDE.md` + `.claude/agents/<name>.md` + `.claude/commands/<name>.md` + `.claude/settings.json`
   - cursor → `.cursor/rules/harness-sdd.mdc` + `.cursor/commands/harness-<name>.md`
   - codex → `AGENTS.md` native entry (no generated files; see `.agents/adapters/codex/README.md`)
   - other CLIs → consult your CLI's documentation

9. **Mark the file(s) as AUTOGENERATED.**
   Add a header comment at the top of every generated file:
   - opencode (JSONC): `// AUTOGENERATED FROM .agents/agentic.json — DO NOT EDIT. Source of truth: .agents/agentic.json. Regenerate with: ./.agents/bootstrap.sh <cli>`
   - Markdown: `> AUTOGENERATED FROM .agents/agentic.json — DO NOT EDIT. Regenerate with ./.agents/bootstrap.sh <cli>`
   - TOML: `# AUTOGENERATED FROM .agents/agentic.json — DO NOT EDIT.`

10. **Verify.**
    Run `./check.sh`. It detects whether an adapter exists and warns if not.

11. **Notify the user.**
    Tell the user:
    > "Generated `<file(s)>`. Restart your CLI to activate Harness SDD."

12. **STOP this session.**
    Do not continue answering the user's request until they have restarted the CLI.

## Caveats and limitations

- Your CLI may not have an exact equivalent for `permission` (e.g., Gemini CLI
  has soft permission via system prompt, not hard file ACLs). Document any
  limitations in your adapter's `README.md` so users know what is enforced
  versus merely instructed.
- Your CLI may not have a slash command concept. In that case, omit the
  `commands` section and document the available workflows as skills or as
  text in the main instructions file.
- If you can scaffold a reusable adapter for your CLI under
  `.agents/adapters/<your-cli>/`, consider contributing it back to the
  framework so future users get deterministic generation instead of LLM
  translation every time.

## Contributing a new adapter

To add a reusable adapter:

1. Create `.agents/adapters/<your-cli>/`.
2. Add one or more `*.tmpl` files using a simple `{{ PLACEHOLDER }}` syntax.
3. Document the field mapping in `README.md`.
4. Add a case for your CLI in `.agents/adapters/_common/render.py`.
5. Optionally include a `_template.<ext>.tmpl` parametrized file for sub-agents
   and commands so the renderer can produce one file per item.

The render script supports `{{ SIMPLE_VAR }}` substitution plus a `{{ LOOP:array_key }} ... {{ ENDLOOP }}` block for iterating over arrays.
