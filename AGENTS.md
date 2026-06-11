# AGENTS.md — Navigation map for agents

> This file is the **entry point** for any agent working in this repository.
> It is not a rulebook: it is a **map**. Read only what you need when you need it (progressive disclosure).

---

## §0 — Framework Bootstrap (READ FIRST, MANDATORY)

This repository implements the **Harness SDD framework**. Before doing anything else
in this session, you MUST verify your CLI has its native adapter in place.

### Step 1 — Identify your CLI
You are one of: `opencode`, `gemini-cli`, `claude-code`, `agy`, or another agentic CLI.
You usually know which one you are from your runtime context. If unsure, ask the user.

### Step 2 — Check whether your adapter exists
Look in the repository root for the native config file your CLI expects:

| CLI          | Expected artifact in repo root |
|--------------|--------------------------------|
| opencode     | `opencode.json` or `opencode.jsonc` |
| gemini-cli   | `GEMINI.md` (and optionally `.gemini/commands/*.toml`) |
| claude-code  | `CLAUDE.md` and `.claude/` |
| other        | varies — see `.agents/BOOTSTRAP.md` |

### Step 3 — If the adapter is MISSING, bootstrap NOW
1. Run `./.agents/bootstrap.sh detect` to confirm your CLI is recognized.
2. If recognized: run `./.agents/bootstrap.sh <your-cli>` to generate the adapter from `.agents/agentic.json`.
3. If NOT recognized: read `.agents/BOOTSTRAP.md`, translate `.agents/agentic.json` manually to your CLI's native format using `.agents/adapters/opencode/` as a reference example, write the resulting file(s) to wherever your CLI scans them.
4. Tell the user: **"Generated <file(s)>. Restart your CLI to activate Harness SDD."**
5. **STOP this session**. Do not continue answering the user's request until they have restarted the CLI.

### Step 4 — If the adapter EXISTS, continue normally
Proceed to §1 below. Skip §0 in future sessions in this repository (the adapter is already there).

---

## §0.5 — Project Profiling (mandatory once per clone)

After the adapter is generated (§0) and **before** you start any SDD work (§1),
shape the manifest to your project.

**Recommended entry point — agent-driven `/init`:**
tell the agent *"run /init"* (or invoke the slash command directly). The
agent reads `.agents/commands/init.md` and walks the 3-stage lifecycle on
its own initiative. The human supervises — the human does **not** run the
scripts. The `/init` body has a strict **completion gate**:
`./.agents/bootstrap.sh init --validate` MUST exit 0 before the init is
declared done. The agent cannot skip this step — the validator catches
scaffold metadata leaks (`_lifecycle`, `_intent`, `category` in
`subagents[]`), missing fields, and leftover scaffolds.

**Manual entry point (human-driven, equivalent to `/init`):**
```bash
./.agents/bootstrap.sh profile                # report: active set + scaffold lifecycle status
./.agents/bootstrap.sh add-agent <name>       # opt-in: borrow a scaffold as-is (Stage 2)
./.agents/bootstrap.sh remove-examples        # opt-in: drop the scaffolds (Stage 3)
./.agents/bootstrap.sh init                   # status only: shows the /init workflow + current state
./.agents/bootstrap.sh init --validate        # OBJECTIVE completion gate (exits 0 when /init is complete)
```

**The default install is fully clean.**

When you run `bootstrap.sh <cli>`, the manifest that ships with the template
is shaped to your project before anything is written:

- `subagents[]` starts **empty**. No sub-agents are installed by default.
- The template's sub-agents live in `agentic.json#_template_subagents_examples[]`
  as **scaffolds** — patterns to be used as a basis for the project's own
  sub-agents, never rendered into CLI adapters, never active.
- The leading-underscore convention on the field name (`_template_*`) and on
  per-example metadata (`_lifecycle`, `_intent`) is the manifest's way of
  signalling "this is a template artifact, not project state".
- If a `SUBAGENT.md` is missing for an active sub-agent, it is auto-scaffolded
  from `.agents/subagents/agent-template/`. Customizations are never overwritten.

**Auto-detection hint (for the agent):**

When you start a session on a project with `subagents[] = []` and a non-empty
`_template_subagents_examples[]`, the install is **fresh**. Suggest the user
run `/init` (you can also run it yourself on their behalf). Once the manifest
is shaped (`_template_*` removed), do not suggest `/init` again — it is a
one-time operation. To add a sub-agent later, edit `agentic.json` directly.

When you run `/init`, you MUST loop until both
`./.agents/bootstrap.sh init --validate` and `./check.sh` exit 0. Do not
declare the init done if either fails — fix the errors and re-run. The
schema is strict on purpose: it catches the common agent mistakes
(scaffold metadata leaked, description copied verbatim, scaffolds not
dropped, role_file missing).

**The scaffold lifecycle (3 stages)**

The intent is documented **inside the manifest** at `agentic.json#_template_lifecycle`:

| Stage | Command                                | What you do                                                                                                                                                      |
|-------|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1. SCAFFOLD   | `./.agents/bootstrap.sh profile`         | Read the entries in `_template_subagents_examples[]` to see the patterns the framework provides (4 canonicals + 3 illustrative). Each entry carries a `_lifecycle: "scaffold"` and a `_intent` field describing how to use it. |
| 2. IMPLEMENT  | `./.agents/bootstrap.sh add-agent <name>` (or copy + edit `agentic.json` manually) | For each sub-agent your project needs, copy a scaffold, customize `name` / `description` / `permission` / `role_file` / `applies_when`, and add the customized version to `subagents[]`. `add-agent` borrows a scaffold as-is; for customization, copy by hand so you can change fields freely. |
| 3. REMOVE     | `./.agents/bootstrap.sh remove-examples` | Once the project's sub-agents are in `subagents[]`, drop the scaffolds. This removes `_template_subagents_examples[]` and `_template_lifecycle` from the manifest, and re-renders all CLI adapters. The final state contains only the project's sub-agents. |

**Examples**

Scaffold-only browsing:

```bash
./.agents/bootstrap.sh profile
#   Active sub-agents (in subagents[]):
#     (none)
#
#   Template scaffolds (use them, then drop them):
#     ~ harness            default (canonical)
#     ~ spec-author        default (canonical)
#     ~ implementer        matches applies_when (['file_glob'])  (canonical)
#     ~ reviewer           default (canonical)
#     ~ cloud-architect    matches applies_when (['file_glob'])  (illustrative)
#     ~ frontend-specialist  (illustrative)
#     ~ data-engineer        (illustrative)
#
#   Each entry carries _lifecycle: "scaffold" and a _intent field.
#   Run `./.agents/bootstrap.sh remove-examples` after implementing your sub-agents.
```

Borrow a scaffold as-is (Stage 2 — quick try):

```bash
./.agents/bootstrap.sh add-agent implementer
#   Promote 'implementer' from _template_subagents_examples to subagents[]? [y/N]: y
#   promoted 'implementer' from _template_subagents_examples to subagents[]
#   saved .agents/agentic.json
#   scaffolded .agents/subagents/implementer/SUBAGENT.md
#   Re-rendering adapters for all CLIs...
```

Or copy + customize (Stage 2 — recommended for project-specific work):

```bash
# Edit .agents/agentic.json: copy the "implementer" entry from
# _template_subagents_examples[] into subagents[] with your project's
# name (e.g. "python-implementer"), your file_glob list, and your
# permission policy. The scaffold stays in the manifest for reuse.
```

Drop the scaffolds (Stage 3 — final, project-only state):

```bash
./.agents/bootstrap.sh remove-examples
#   This will drop the template scaffolds from .agents/agentic.json:
#     - _template_subagents_examples[] (6 entries)
#     - _template_lifecycle
#
#   The leading-underscore convention guarantees they were never rendered.
#   Sub-agents already promoted to subagents[] (via 'add-agent') are NOT affected.
#
#   Remove the template scaffolds? [y/N]: y
#   saved .agents/agentic.json
#   removed _template_subagents_examples[] (6 scaffold entries)
#   removed _template_lifecycle
#
#   Re-rendering adapters for all CLIs...
#   Done. The manifest now contains only the project's sub-agents.
```

Use `... --yes` to skip the confirmation prompt in non-TTY contexts (CI,
scripts). The default for non-interactive stdin is **N** for safety.

**Decision rules in `agentic.json`**

| Field                                | Meaning                                                                                 |
|--------------------------------------|-----------------------------------------------------------------------------------------|
| `subagents[]`                        | Active sub-agents. Always rendered. Default install = **empty**.                        |
| `_template_subagents_examples[]`     | Scaffolds. Never rendered by default. Removed by `remove-examples`.                     |
| `_template_lifecycle`                | Top-level documentation of the scaffold lifecycle (intent + stages). Read by humans.    |
| `subagents[].default`                | `true` ⇒ always active. `false` ⇒ opt-in via `applies_when`.                            |
| `subagents[].applies_when`           | Block of `file_exists` / `file_glob` patterns. AND-combined.                            |
| `subagents[].role_file`              | Path to the sub-agent's `SUBAGENT.md`. Auto-scaffolded from `agent-template/` if missing. |
| `_template_subagents_examples[]._lifecycle` | `scaffold` — the entry is a template pattern, not a live sub-agent.                 |
| `_template_subagents_examples[]._intent`    | Human-readable hint: how to use this scaffold.                                   |

Re-run `profile` and `add-agent` any time the project stack changes (e.g. you
add Terraform, a `src/App.tsx`, a `notebooks/` folder, etc.). Run
`remove-examples` exactly once, when the project's sub-agents are in place.

---

## §1 — Before starting (mandatory)

1. Run `./check.sh` and verify it finishes without errors. If it fails, **stop** and resolve the environment before touching code.
2. Read `DESIGN.md` to understand the high-level architecture and global principles.
3. Read `feature_list.json`. Every new feature with `"sdd": true` goes through **Spec Driven Development**.
4. Read `progress/current.md` to understand the state of the last session.
5. If the task involves an SDD feature, read `specs/README.md` and `docs/sdd.md`.

## §2 — Repository Map

| File / Folder | Content | When to read it |
|---|---|---|
| `AGENTS.md` | This file (entry point, framework bootstrap) | Every new session — §0 is mandatory |
| `DESIGN.md` | High-level architecture and global principles | For architectural context |
| `feature_list.json` | Feature list with status (pending/spec_ready/in_progress/done/blocked) | At the start of every session |
| `progress/current.md` | Current session state | At the start of every session |
| `progress/history.md` | Append-only log of previous sessions | If historical context is needed |
| `.agents/agentic.json` | **Canonical CLI-agnostic manifest** (single source of truth for agents/skills/commands) | When regenerating adapters or adding capabilities |
| `.agents/BOOTSTRAP.md` | Instructions for bootstrapping unknown CLIs | When your CLI lacks a prebuilt adapter |
| `.agents/bootstrap.sh` | Deterministic adapter renderer | To regenerate an adapter or run `./.agents/bootstrap.sh --check` |
| `.agents/adapters/<cli>/` | Per-CLI adapter templates and field mapping documentation | When adding support for a new CLI |
| `.agents/subagents/<role>/SUBAGENT.md` | Canonical role definitions (CLI-agnostic) | When acting in that role |
| `.agents/skills/<name>/SKILL.md` | Specialized agent skills and domain knowledge (run `./.agents/skills/sync-skills.sh` to update) | When specialized workflows are needed |
| `.agents/commands/<name>.md` | Canonical slash-command bodies | When the user invokes `/status`, `/spec`, `/approve`, etc. |
| `specs/<feature>/` | requirements.md + design.md + tasks.md (SDD format) | Before implementing any feature with `"sdd": true` |
| `docs/sdd.md` | Complete SDD process (EARS, traceability, templates) | Before drafting or reading a spec |
| `check.sh` | Verification script (build, tests, validations, adapter consistency) | Before declaring a task as done |

## §3 — Hard Rules (non-negotiable)

- **One feature at a time.** Do not mix changes from multiple tasks in the same session.
- **Do not declare a task `done` without green tests.** Run `./check.sh` and ensure it passes.
- **Do not skip the spec phase.** Every feature with `"sdd": true` must pass through spec-author and get human approval before touching code.
- **Do not skip the human approval gate.** The flow stops at `spec_ready` and waits.
- **Document what you do** in `progress/current.md` while you work, not at the end.
- **Leave the repository clean** before closing the session (see §5).
- **Do not edit generated adapters by hand** (`opencode.json`, `GEMINI.md`, `CLAUDE.md`, `.claude/`, `.gemini/`). Edit `.agents/agentic.json` and re-run `./.agents/bootstrap.sh <cli>` instead.
- **Sub-agent management**: `.agents/agentic.json#subagents[]` is the source of truth for active sub-agents. Adding a sub-agent there and creating `.agents/subagents/<name>/SUBAGENT.md` activates it. Removing it from `agentic.json` deactivates it on the next render. For the four canonical agents (`harness`, `spec-author`, `implementer`, `reviewer`), removal from `agentic.json` also prunes the directory on disk during `./.agents/bootstrap.sh <cli>`. To customize a canonical agent's behavior without losing the option to revert, copy it to a new name (e.g. `implementer-terraform`) instead of editing it in place. Project-specific agents are never auto-pruned. Scaffolds in `agentic.json#_template_subagents_examples[]` are starting points for the project's own sub-agents — copy + customize, then drop them with `./.agents/bootstrap.sh remove-examples` once the project is set up.

## §4 — Workflow (SDD)

```
pending → [spec-author] → spec_ready → ⏸ HUMAN → in_progress → [implementer → reviewer] → done
```

1. The agent detects the first `pending` feature with `"sdd": true` in `feature_list.json`.
2. The agent (as spec-author) reads `DESIGN.md` for architectural context.
3. The agent creates `specs/<name>/{requirements,design,tasks}.md` and marks status as `spec_ready`.
4. **Pause.** The human reads the spec in `specs/<name>/` and approves (or requests changes).
5. Once approved, change status to `in_progress` and proceed with implementation.
6. Execute `tasks.md` one by one, marking `[x]`.
7. Verify traceability `R<n>` ↔ test and completed tasks.
8. Run `./check.sh` — it must pass.
9. Mark as `done` and record the summary in `progress/progress.md`.

## §5 — Session Closing

Before finishing:

1. Run `./check.sh` — all green.
2. If the task is finished: set `status: "done"` in `feature_list.json`.
3. Move the summary from `progress/current.md` to the end of `progress/history.md`.
4. Empty `progress/current.md`, leaving only the template.
5. Do not leave temporary files, debug print() statements, or TODOs without context.

## §6 — Repository Stack

> **NOTE:** Customize this section according to your real project's technology stack. The bootstrap also detects the stack automatically and tailors permissions (see `.agents/adapters/_common/project-detect.py`).

| Layer | Technology |
|------|-----------|
| Infrastructure | *[e.g., Terraform, Terragrunt, Pulumi, CloudFormation]* |
| Orchestration / K8s | *[e.g., Helm, Kustomize, Crossplane, Docker Compose]* |
| CI/CD | *[e.g., GitHub Actions, GitLab CI, ArgoCD, Jenkins]* |
| Languages | *[e.g., Python, Go, TypeScript, Java, Rust]* |
| Validation | *[e.g., pytest, vitest, golangci-lint, tflint, checkov, trivy]* |

## §7 — Project Subagents

The **canonical roles** for the Harness SDD workflow live in `.agents/subagents/`:

| Role | File | Responsibility |
|------|------|----------------|
| `harness` | `.agents/subagents/harness/SUBAGENT.md` | Default orchestrator. Reads `feature_list.json` and routes work. |
| `spec-author` | `.agents/subagents/spec-author/SUBAGENT.md` | Produces specs in EARS notation. Never writes production code. |
| `implementer` | `.agents/subagents/implementer/SUBAGENT.md` | Executes `tasks.md` sequentially on the active feature. |
| `reviewer` | `.agents/subagents/reviewer/SUBAGENT.md` | Verifies R<n>↔test traceability and runs `./check.sh`. |
| `agent-template` | `.agents/subagents/agent-template/SUBAGENT.md` | **Template** — copy this directory to create new subagents. |

Additional subagents referenced in `.agents/harness/ROUTING.md` (e.g., `cloud-architect`, `platform-engineer`, `tester-agent`, `security-reviewer`, `escriba`, `quality-agent`) are **illustrative**. Scaffold them by copying `agent-template/` before invoking them.

## §8 — Agent Skills Registry

Expert knowledge and specialized workflows are managed centrally so this template stays agnostic.

- **Repository:** [agent-skills-registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git)
- **Available Skills:**
    - `harness-sdd`: Full SDD workflow (canonical to this template).
    - `ears-requirements`: How to write requirements in EARS notation.
    - `terraform-structure`: Folder standards and metadata management for Terraform.
    - `skill-governance`: Mandatory workflow (GitFlow + SDD + MR) for contributing back to the registry.
- **Usage:** Run `./.agents/skills/sync-skills.sh` at the start of a session if you detect that skills required for the current task are missing.
- **Contribution:** Any contribution to the registry must follow the `skill-governance` skill (feature branches + Merge Requests in GitLab).

## §9 — CLI-agnostic integration (Harness Bootstrap)

This template is **CLI-agnostic**. It does **not** ship hand-crafted config files for any particular CLI. Instead:

1. **The canonical source of truth is `.agents/agentic.json`** — a declarative JSON manifest describing instructions, subagents, skills, commands, permissions, and stack-aware extensions.
2. **Each CLI has its own adapter** in `.agents/adapters/<cli>/` consisting of templates (`*.tmpl`) and a `README.md` field-mapping document.
3. **`./.agents/bootstrap.sh <cli>`** is a deterministic Python-backed renderer that turns the manifest into the CLI's native config file(s).
4. **Generated artifacts** (`opencode.json`, `GEMINI.md`, `CLAUDE.md`, `.claude/`, `.gemini/`) are listed in `.gitignore`. Each developer runs the bootstrap once after cloning.
5. **`.agents/BOOTSTRAP.md`** documents the manual fallback when an LLM must translate `agentic.json` for an unknown CLI without a prebuilt adapter.

To add a new CLI: copy `.agents/adapters/opencode/` to `.agents/adapters/<your-cli>/`, edit the templates and the README to map fields to your CLI's schema, then add a case in `.agents/adapters/_common/render.py`.

To change capabilities (a new subagent, skill, or command): **edit `.agents/agentic.json`** and re-run `./.agents/bootstrap.sh <your-cli>`. Never edit the generated adapter files directly.



### Skill Loading Mechanism
According to the `agentskills.io` standard, skill association and loading happens in two ways:
1. **Explicit Association (Primary):** Sub-agents explicitly declare the skills they need in their `SUBAGENT.md` under the `## Skills` section. The agent MUST load these skills fully when assuming the role.
2. **Progressive Disclosure (Dynamic):** For skills not explicitly linked, the agent reads ONLY the YAML frontmatter (`name` and `description`) of `SKILL.md` files in `.agents/skills/`. If the current task matches the `description` trigger, the agent MUST read and apply the full skill.
