# Framework customization and troubleshooting

## How to Customize for Your Stack

### Adapt `check.sh`

The `check.sh` script detects what tools are available on the machine and runs only the relevant checks. Add blocks for your specific tools by following the pattern already in the file — each block is guarded by `command -v <tool>` so it only runs when the tool is installed.

### Adapt the canonical manifest

Edit `.agents/agentic.json` directly:

- Add or remove entries in `subagents[]` (the active set).
- Add `_lifecycle: "scaffold"` entries to `_template_subagents_examples[]` to publish project-specific sub-agent patterns for your team.
- Add or extend `project_detect[]` rules to set stack-aware permission overrides and skills for your languages and tools.

After every change, re-render the CLI adapters:

```bash
./.agents/bootstrap.sh <cli>          # Render for one CLI
./.agents/bootstrap.sh clean          # Remove generated adapters of CLIs not in target_clis
./.agents/bootstrap.sh --check        # Drift check (CI-friendly)
```

### Adapt EARS templates

The templates in `specs/templates/` use generic examples. Replace them with examples relevant to your specific domain and language so that the spec-author agent produces specs that match your codebase style.

### Add a new CLI

Copy `.agents/adapters/_generic/` to `.agents/adapters/<your-cli>/` and write the adapter. The bootstrap mechanism is data-driven; see [`.agents/BOOTSTRAP.md`](../.agents/BOOTSTRAP.md) for the LLM fallback when no prebuilt renderer exists.

---

## FAQ and Troubleshooting

**Q: My CLI is not in the list of supported adapters.**
A: Read [`.agents/BOOTSTRAP.md`](../.agents/BOOTSTRAP.md) — it explains how to translate the canonical manifest to your CLI's native format by hand, or how to add a prebuilt adapter.

**Q: `bootstrap.sh --check` reports DRIFT.**
A: The canonical manifest and the on-disk adapter have diverged. Re-run `./.agents/bootstrap.sh <cli>` to regenerate.

**Q: `check.sh` says a canonical sub-agent is "orphaned".**
A: The canonical directory exists on disk but is not in `.agents/agentic.json` (neither in `subagents[]` nor in `_template_subagents_examples[]`). Either restore the entry, run `./.agents/bootstrap.sh prune` to clean up, or move the canonical into `_template_subagents_examples[]` if you want to keep it as a scaffold.

**Q: I want to add a sub-agent that's not a scaffold — a permanent part of my project.**
A: Add it directly to `subagents[]` in `.agents/agentic.json`. You don't need to use `add-agent`; that's only for borrowing scaffolds.

**Q: I want to share my project's sub-agents with other teams.**
A: Move them from `subagents[]` to `_template_subagents_examples[]` (with a `_lifecycle: "scaffold"` and an `_intent` hint) and ship the manifest. Other projects can then use `add-agent` to borrow them.

**Q: `add-agent` prompts even when I pass `--yes`. What's happening?**
A: If the scaffold entry is not in `_template_subagents_examples[]` (e.g. you typed a name that doesn't exist), the renderer reports the error and exits 1 — `--yes` only skips the human confirmation, not validation errors.

**Q: I want the agent to do the project setup, not me. How?**
A: Tell the agent *"run /init"* (or invoke the `/init` slash command directly). The agent reads `.agents/commands/init.md` and walks the 3-stage lifecycle (SCAFFOLD → IMPLEMENT → REMOVE) on its own, then runs `./check.sh` and reports. The human supervises; the agent does the work. This is the recommended path — it works the same way across opencode, gemini-cli, claude-code, and any other agentic CLI that supports slash commands.

**Q: The agent ran `/init` but the result is wrong — scaffolds still there, scaffold metadata leaked into `subagents[]`, description copied verbatim. What now?**
A: This is exactly what `bootstrap.sh init --validate` is designed to catch. Run it: it returns 0 (ok) or 1 (with specific errors). The errors tell you exactly what is wrong. If the agent skipped the validation, run it yourself and feed the errors back to the agent.

**Q: What are steering files and how do I use them?**
A: Steering files (in `steering/`) are Markdown files with YAML frontmatter that customize agent behavior globally or per role. Declare them in `agentic.json#steering[]` and manage them with `bootstrap.sh add-steering` / `remove-steering`. The framework ships with 2 scaffold examples.

**Q: What are lifecycle hooks and when do they fire?**
A: Hooks (`hooks/`) are shell scripts that execute automatically at SDD transition points — spec created, approved, implementation start/complete, review, feature done, check pass. The runner is `hooks/run-hooks.sh`. See `docs/sdd.md §7` for the full reference. Managed via `bootstrap.sh add-hook` / `remove-hook`.

**Q: Is this a framework or a template?**
A: Both. You start by copying it (template), but once in place it defines the rules, enforces the lifecycle, and provides the tooling — that's a framework. The distinction that matters: projects work *within* the harness, not just starting from it.

**Q: Does this work only for infrastructure projects?**
A: No. The framework is stack-agnostic. It works for any software project — backend APIs, frontend applications, data pipelines, CLI tools, platform services. Stack-specific tooling (linters, validators) is detected at runtime via `project_detect[]` in the manifest and is always optional.

---

> **Based on:** Real-world implementations in multiple production projects.
