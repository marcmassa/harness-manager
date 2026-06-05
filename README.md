# Harness SDD — Implementation Template

Template for adopting **Harness Engineering + Spec Driven Development (SDD)** in any software project (Infrastructure, Platform, or Application).

This template provides a structured, traceable, and verifiable workflow for AI agents and human developers to collaborate effectively. It is **CLI-agnostic**: a single canonical manifest drives the native config for opencode, gemini-cli, claude-code, or any other agentic CLI.

---

## Index

- [What is Harness Engineering?](#what-is-harness-engineering)
- [Why SDD + Harness?](#why-sdd--harness)
- [Benefits](#benefits)
- [Template Installation Lifecycle](#template-installation-lifecycle)
- [Complete SDD Workflow](#complete-sdd-workflow)
- [Template Structure](#template-structure)
- [Quick Adoption Guide (5 steps)](#quick-adoption-guide-5-steps)
- [Slash Commands](#slash-commands-available)
- [How to Customize for Your Stack](#how-to-customize-for-your-stack)
- [FAQ and Troubleshooting](#faq-and-troubleshooting)
- [License & Authority](#license--authority)

---

## What is Harness Engineering?

**Harness Engineering** is a methodology to structure code repositories so that AI agents can work on them autonomously, traceably, and verifiably.

The harness has 4 pillars:

| Pillar | Meaning | Implementation |
|-------|-----------------|----------------------|
| **1. The Repo IS the System** | All info an agent needs is in the repo, not in the dev's mind | `AGENTS.md`, `feature_list.json`, `specs/`, `progress/`, `docs/` |
| **2. Spec Driven Development** | No code is written until requirements are specified, designed, and approved by a human | `specs/<feature>/{requirements,design,tasks}.md` with R<n> ↔ test traceability |
| **3. Operational Memory on Disk** | Session state, decisions, and backlog live in files, not in the chat | `progress/{current,progress,backlog,decisions,handoff}.md` |
| **4. Executable Verification** | A script (`check.sh`) validates builds, tests, spec integrity, and harness rules | `check.sh` — gateway for declaring a task as `done` |

---

## Why SDD + Harness?

### The Problem

Without an explicit harness, AI agent interactions often follow this pattern:

```
Human: "Add support for X"
Agent: (writes code without full context)
       (skips steps, assumes non-existent conventions)
       (leaves repo in an indeterminate state)
Human: (reviews, finds errors, asks for changes)
Agent: (iterates without memory of the previous iteration)
       → Frustration, wasted time, inconsistent code
```

### The Solution

With SDD + Harness, the flow is:

```
Human: "Add support for X"
Agent (spec-author):
  1. Reads feature_list.json → detects feature with sdd:true, status:pending
  2. Creates specs/feature-x/requirements.md (EARS: R1, R2, ...)
  3. Creates specs/feature-x/design.md (files, signatures, alternatives)
  4. Creates specs/feature-x/tasks.md (checklist T1, T2, ... with R<n>)
  5. Sets status: spec_ready and STOPS

⏸ Human: Reads the 3 files in specs/feature-x/ and says "approved"

Agent (implementer):
  6. Executes tasks.md sequentially, marking [x]
  7. Adds tests with R<n> ↔ test traceability
  8. Runs ./check.sh → all green
  9. Sets status: done in feature_list.json
 10. Logs in progress/progress.md

→ Full traceability, 0 ambiguity, human only reviews once
```

---

## Benefits

1. **Full Traceability:** Every decision is recorded in `progress/decisions.md` (ADR). Requirements (R1, R2...) map to specific tests.
2. **One Feature at a Time:** The harness ensures only one feature is `in_progress`, avoiding context switching and dependencies.
3. **Multi-Team Consistency:** Developers, SREs, and AI agents follow the same flow (spec → approval → code → tests → close).
4. **Reduced Code Review Friction:** Reviewers trust the process (approved spec + `check.sh` + traceability).
5. **AI Agent Onboarding:** A new agent can read `AGENTS.md` and `feature_list.json` to understand the project state immediately.
6. **Modular & Agnostic Architecture:** The template methodology is technology-independent. Specific technical knowledge is pulled from a centralized [Agent Skills Registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git).
7. **CLI-Agnostic Bootstrap:** One canonical manifest (`.agents/agentic.json`) generates the native config for opencode, gemini-cli, claude-code, or any other agentic CLI. No vendor lock-in.

---

## Template Installation Lifecycle

When you copy this template into a project, the framework's sub-agents ship as **scaffolds** — patterns for you to use as a basis for your own project-specific sub-agents, never installed by default. The lifecycle has 3 stages:

```
                      ┌──────────────────────────────────────────────────┐
                      │   Copy the template into your project            │
                      │   (preserves _template_subagents_examples[])     │
                      └────────────────────────┬─────────────────────────┘
                                               │
                                               ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  STAGE 1 — SCAFFOLD                                                  │
   │  $ ./.agents/bootstrap.sh profile                                   │
   │                                                                     │
   │  Read the entries in _template_subagents_examples[] to see the      │
   │  patterns the framework provides.                                   │
   │  4 canonicals (harness, spec-author, implementer, reviewer) +       │
   │  3 illustrative (cloud-architect, frontend-specialist, data-engineer)│
   │  Each entry carries _lifecycle: "scaffold" + an _intent hint.      │
   └────────────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  STAGE 2 — IMPLEMENT                                                 │
   │  For each sub-agent your project needs, copy a scaffold into        │
   │  subagents[] and customize it (name, description, permission,        │
   │  role_file, applies_when).                                          │
   │                                                                     │
   │  Quick try:    ./.agents/bootstrap.sh add-agent <name> --yes        │
   │  Customize:    copy + edit .agents/agentic.json by hand             │
   │                 (e.g. implementer -> python-implementer)            │
   │                                                                     │
   │  The renderer auto-scaffolds the SUBAGENT.md from                   │
   │  .agents/subagents/agent-template/ if it is missing.                │
   └────────────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  STAGE 3 — REMOVE                                                    │
   │  $ ./.agents/bootstrap.sh remove-examples --yes                     │
   │                                                                     │
   │  Drops _template_subagents_examples[] and _template_lifecycle from  │
   │  .agents/agentic.json. Sub-agents already promoted to subagents[]   │
   │  are NOT affected. Re-renders all CLI adapters.                     │
   └────────────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  FINAL — project-only manifest                                      │
   │                                                                     │
   │  subagents[] = the project's sub-agents only.                       │
   │  No _template_* residue, no placeholder entries, no leftover         │
   │  scaffold metadata. Just the project, shaped by the project.        │
   └─────────────────────────────────────────────────────────────────────┘
```

The intent is documented **inside the manifest itself** at `agentic.json#_template_lifecycle` — the lifecycle is part of the project's source of truth, not external documentation that can drift.

---

## Complete SDD Workflow

Once the template is installed and your project's sub-agents are in place, the day-to-day workflow follows the SDD state machine:

```
                          ┌──────────────────────────────────────────┐
                          │           feature_list.json              │
                          │  (one feature at a time, sdd:true/false) │
                          └──────────────────────────────────────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │    pending       │
                               │  (no spec yet)   │
                               └────────┬─────────┘
                                        │ spec-author
                                        │ creates specs/<feature>/{requirements,design,tasks}.md
                                        ▼
                               ┌─────────────────┐
                               │   spec_ready     │
                               │  (⏸ waiting)     │◄──────────────────┐
                               └────────┬─────────┘                   │
                                        │                             │
                               ┌────────▼────────┐                   │
                               │  HUMAN          │── No → fix ───────┘
                               │  APPROVAL       │
                               └────────┬─────────┘
                                        │ Yes
                                        ▼
                               ┌─────────────────┐
                               │  in_progress     │
                               │  (implementing)  │
                               └────────┬─────────┘
                                        │ implementer follows tasks.md
                                        │ reviewer validates R<n>↔test traceability
                                        │ check.sh passes
                                        ▼
                               ┌─────────────────┐
                               │     done         │
                               │  (closed)        │
                               └─────────────────┘
```

---

## Template Structure

```
harness-sdd-template/
├── AGENTS.md                  # Navigation map for agents (read this first)
├── README.md                  # This file
├── DESIGN.md                  # High-level architecture
├── SECURITY.md                # Security policy
├── LICENSE                    # MIT License (full text)
├── AUTHORITY.md               # Authority statement (copyright, contributions)
├── check.sh                   # Verification gateway (lint, test, drift, ...)
├── feature_list.json          # Source of truth for features (one at a time)
│
├── .agents/                   # Framework internals
│   ├── agentic.json           #   Canonical manifest (source of truth)
│   ├── BOOTSTRAP.md           #   LLM fallback for unknown CLIs
│   ├── bootstrap.sh           #   Renderer dispatcher
│   ├── adapters/              #   CLI adapter templates (opencode, gemini-cli, claude-code, ...)
│   ├── subagents/             #   Sub-agent role files
│   │   ├── agent-template/    #     Scaffold source for new sub-agents
│   │   ├── harness/           #     Reference role files (Stage 1 scaffolds)
│   │   ├── spec-author/
│   │   ├── implementer/
│   │   └── reviewer/
│   ├── skills/                #   Specialized skills (sync'd from the registry)
│   ├── commands/              #   Slash-command bodies (/spec, /implement, ...)
│   └── harness/               #   Operational docs (CONVENTION, ROUTING, ...)
│
├── specs/                     # Spec Driven Development artifacts
│   ├── README.md              #   How to write a spec
│   └── templates/             #   EARS templates (requirements, design, tasks)
│
├── progress/                  # Operational memory on disk
│   ├── current.md             #   Live session state
│   ├── progress.md            #   Append-only history
│   ├── backlog.md             #   Deferred items
│   ├── decisions.md           #   Architecture Decision Records
│   └── handoff.md             #   Hand-off notes between sessions
│
└── examples/                  # Reference implementations
    └── deploy-cluster/        #   End-to-end SDD example
```

The canonical source of truth is `.agents/agentic.json`. Every CLI-specific config
(`opencode.json`, `GEMINI.md`, `CLAUDE.md`, etc.) is generated from it by
`./.agents/bootstrap.sh <cli>` and is **gitignored** — each developer regenerates
their own after cloning.

---

## Quick Adoption Guide (5 steps)

### Step 1 — Copy the template into your repo

```bash
cp -r harness-sdd-template/. /path/to/your/repo/
cd /path/to/your/repo
```

### Step 2 — Install the CLI adapter (clean install)

```bash
./.agents/bootstrap.sh detect                # See which CLIs are supported and detect your stack
./.agents/bootstrap.sh opencode              # Or: gemini-cli | claude-code | --all
                                             # Default install is clean: subagents[] starts empty.
```

### Step 3 — Shape the manifest to your project (the 3-stage lifecycle)

**Agent-driven (recommended):** tell your AI agent *"run /init"*. The agent
reads `.agents/commands/init.md`, walks the SCAFFOLD → IMPLEMENT → REMOVE
stages, and reports the result. The human supervises; the agent does the work.

**Manual (equivalent):**

```bash
./.agents/bootstrap.sh profile               # STAGE 1: read the 7 scaffolds
./.agents/bootstrap.sh add-agent <name>      # STAGE 2: borrow a scaffold as-is (or copy + edit agentic.json)
# ... build your project's sub-agents (with the schema from .agents/commands/init.md) ...
./.agents/bootstrap.sh remove-examples       # STAGE 3: drop the scaffolds when done
./.agents/bootstrap.sh init --validate       # COMPLETION GATE: MUST exit 0 before init is declared done
```

The completion gate (`init --validate`) catches the common agent mistakes
that the user reported during real-world testing:
- scaffold metadata leaked into `subagents[]` (`_lifecycle`, `_intent`, `category`)
- description copied verbatim from the scaffold (not customized)
- scaffolds not dropped (`_template_subagents_examples[]` still present)
- `role_file` pointing to a non-existent file
- required fields missing (`name`, `mode`, `description`, `role_file`, `permission`)

The agent MUST loop until `--validate` exits 0. Do not declare `/init`
done otherwise.

See [Template Installation Lifecycle](#template-installation-lifecycle) for the full diagram.

### Step 4 — Verify the environment

```bash
./check.sh                                   # Must pass before any SDD work begins
```

### Step 5 — Launch the first SDD cycle

Add a feature to `feature_list.json` with `"sdd": true`, then ask your AI agent:

> "Apply Harness Engineering with SDD to implement the pending features in feature_list.json"

The agent will read `AGENTS.md`, route to `spec-author`, and stop at `spec_ready` for your approval.

### Slash commands available

The agent exposes these workflows as native slash commands (CLI-specific
names differ; the bodies are identical):

| Slash command | Purpose                                                                 |
|---------------|-------------------------------------------------------------------------|
| `/init`       | Set up the project (one-time scaffold lifecycle). The agent does it.   |
| `/status`     | Show project state (active feature, specs pending, last progress).      |
| `/spec`       | Create the spec for the first `pending` feature with `"sdd": true`.     |
| `/approve`    | Approve a `spec_ready` feature and flip it to `in_progress`.            |
| `/implement`  | Execute `tasks.md` for the feature in `in_progress`.                    |
| `/done`       | Run the reviewer, verify R↔test traceability, mark `done` if green.      |
| `/check`      | Shortcut to `./check.sh`.                                               |

---

## How to Customize for Your Stack

### Adapt `check.sh`

The generic `check.sh` supports Python, TypeScript, Go, and Terraform out of the box. Add blocks for your specific tools (e.g., `hadolint`, `rustc`, `tflint`).

### Adapt the canonical manifest

Edit `.agents/agentic.json` directly:

- Add or remove entries in `subagents[]` (the active set).
- Add `_lifecycle: "scaffold"` entries to `_template_subagents_examples[]` to publish project-specific sub-agent patterns for your team.
- Add or extend `project_detect[]` rules to set stack-aware permission overrides and skills.

After every change, re-render the CLI adapters:

```bash
./.agents/bootstrap.sh <cli>                 # Render for one CLI
./.agents/bootstrap.sh --all                 # Render for every adapter
./.agents/bootstrap.sh --check               # Drift check (CI-friendly)
```

### Adapt EARS templates

The templates in `specs/templates/` use generic examples. Replace them with examples relevant to your specific domain (Infra, Web, Data, etc.).

### Add a new CLI

Copy `.agents/adapters/_generic/` to `.agents/adapters/<your-cli>/` and write the adapter. The bootstrap mechanism is data-driven; see [`.agents/BOOTSTRAP.md`](.agents/BOOTSTRAP.md) for the LLM fallback when no prebuilt renderer exists.

---

## FAQ and Troubleshooting

**Q: My CLI is not in the list of supported adapters.**
A: Read [`.agents/BOOTSTRAP.md`](.agents/BOOTSTRAP.md) — it explains how to translate the canonical manifest to your CLI's native format by hand, or how to add a prebuilt adapter.

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
A: Tell the agent *"run /init"* (or invoke the `/init` slash command directly). The agent reads `.agents/commands/init.md` and walks the 3-stage lifecycle (SCAFFOLD → IMPLEMENT → REMOVE) on its own, then runs `./check.sh` and reports. The human supervises; the agent does the work. This is the recommended way to adopt the template — it works the same way across opencode, gemini-cli, claude-code, copilot, and any other agentic CLI that supports slash commands.

**Q: The agent ran `/init` but the result is wrong — scaffolds still there, scaffold metadata leaked into `subagents[]`, description copied verbatim. What now?**
A: This is exactly what `bootstrap.sh init --validate` is designed to catch. Run it: it returns 0 (ok) or 1 (with specific errors). The errors tell you exactly what is wrong. If the agent skipped the validation, run it yourself and feed the errors back to the agent. The validator catches:
  - Scaffold metadata leaked into `subagents[]` (`_lifecycle`, `_intent`, `category`).
  - Description copied verbatim from the scaffold.
  - Scaffolds not dropped (`_template_subagents_examples[]` still present).
  - `role_file` pointing to a non-existent file.
  - Required fields missing (`name`, `mode`, `description`, `role_file`, `permission`).
  - `_template_lifecycle` still in the manifest.
The agent MUST loop until `init --validate` exits 0. The body of `/init` (`.agents/commands/init.md`) has a strict completion gate that enforces this — re-read the body if the agent is skipping steps.

---

> **Based on:** Real-world implementations in multiple production projects.
