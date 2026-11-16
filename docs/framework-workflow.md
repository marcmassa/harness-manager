# Framework workflow and structure

## What is Harness Engineering?

**Harness Engineering** structures a repository so that AI agents can work on it autonomously, traceably, and verifiably — without requiring a human to re-explain context at the start of every session.

| Pillar | Meaning | Implementation |
|---|---|---|
| **1. The Repo IS the System** | All info an agent needs is in the repo, not in the dev's mind | `AGENTS.md`, `feature_list.json`, `specs/`, `progress/`, `docs/` |
| **2. Spec Driven Development** | No code is written until requirements are specified, designed, and approved by a human | `specs/<feature>/{requirements,design,tasks}.md` with R<n> ↔ test traceability |
| **3. Operational Memory on Disk** | Session state, decisions, and backlog live in files, not in the chat | `progress/{current,progress,backlog,decisions,handoff}.md` |
| **4. Executable Verification** | A script (`check.sh`) validates builds, tests, spec integrity, and harness rules | `check.sh` — the gateway for declaring a task as `done` |
| **5. Customizable Agent Behavior** | Steering files customize per-role directives; lifecycle hooks automate SDD transition points | `agentic.json#steering[]` and `#hooks[]`, managed via `bootstrap.sh add-steering` / `add-hook` |

---

## Complete SDD Workflow

Once the framework is installed, the day-to-day workflow follows the SDD state machine:

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

## Template Installation Lifecycle

When you copy this framework into a project, the sub-agents ship as **scaffolds** — patterns to use as a starting point, never installed by default. The lifecycle has 3 stages:

```
                      ┌──────────────────────────────────────────────────┐
                      │   Copy the framework into your project           │
                      │   (preserves _template_subagents_examples[])     │
                      └────────────────────────┬─────────────────────────┘
                                               │
                                               ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  STAGE 1 — SCAFFOLD                                                  │
   │  $ ./.agents/bootstrap.sh profile                                   │
   │                                                                     │
    │  Read the entries in _template_*_examples[] to see the                │
    │  patterns the framework provides.                                     │
    │  7 sub-agent scaffolds (4 canonicals + 3 illustrative) +              │
    │  2 steering + 3 hooks. Each carries _lifecycle: "scaffold".          │
   └────────────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
    │  STAGE 2 — IMPLEMENT                                                 │
    │  For each sub-agent / steering file / hook your project needs,       │
    │  copy a scaffold into the corresponding active array:                │
    │  subagents[], steering[], hooks[].                                   │
    │                                                                     │
    │  Quick try:    ./.agents/bootstrap.sh add-agent <name> --yes        │
    │                ./.agents/bootstrap.sh add-steering <name> --yes     │
    │                ./.agents/bootstrap.sh add-hook --event ... --script  │
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
    │  Drops all _template_*_examples[] and _template_lifecycle from       │
    │  .agents/agentic.json. Entries already promoted to subagents[],     │
    │  steering[], hooks[] are NOT affected. Re-renders all adapters.     │
    └────────────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  FINAL — project-only manifest                                      │
    │                                                                     │
    │  subagents[] / steering[] / hooks[] = the project's definitions.    │
    │  No _template_* residue, no placeholder entries, no leftover        │
   │  scaffold metadata. Just the project, shaped by the project.        │
   └─────────────────────────────────────────────────────────────────────┘
```

The intent is documented **inside the manifest itself** at `agentic.json#_template_lifecycle` — the lifecycle is part of the project's source of truth, not external documentation that can drift.

The completion gate (`bootstrap.sh init --validate`) catches the common agent mistakes observed during real-world testing:
- Scaffold metadata leaked into `subagents[]` (`_lifecycle`, `_intent`, `category`)
- Description copied verbatim from the scaffold (not customized)
- Scaffolds not dropped (`_template_subagents_examples[]` still present)
- `role_file` pointing to a non-existent file
- Required fields missing (`name`, `mode`, `description`, `role_file`, `permission`)

The agent MUST loop until `--validate` exits 0. Do not declare `/init` done otherwise.

---

## Template Structure

```
harness-sdd-template/
├── AGENTS.md                  # Navigation map for agents (read this first)
├── README.md                  # This file
├── DESIGN.md                  # High-level architecture (fill in for your project)
├── SECURITY.md                # Security policy
├── check.sh                   # Verification gateway (lint, test, spec integrity, ...)
├── feature_list.json          # Source of truth for features (one at a time)
│
├── .agents/                   # Framework internals
│   ├── agentic.json           #   Canonical manifest (source of truth)
│   ├── BOOTSTRAP.md           #   LLM fallback for unknown CLIs
│   ├── bootstrap.sh           #   Renderer dispatcher
│   ├── adapters/              #   CLI adapter templates (opencode, gemini-cli, claude-code, cursor, codex, ...)
│   ├── subagents/             #   Sub-agent role files
│   │   ├── agent-template/    #     Scaffold source for new sub-agents
│   │   ├── harness/           #     Orchestrator
│   │   ├── spec-author/
│   │   ├── implementer/
│   │   └── reviewer/
│   ├── skills/                #   Specialized skills (sync'd from the registry)
│   ├── commands/              #   Slash-command bodies (/spec, /implement, ...)
│   └── harness/               #   Operational docs (CONVENTION, ROUTING, ...)
│
├── steering/                  #   Steering files (per-role agent behavior directives)
├── hooks/                     #   Lifecycle hook scripts + run-hooks.sh runner
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
    └── add-user-api/          #   End-to-end SDD example (stack-agnostic REST API feature)
```

The canonical source of truth is `.agents/agentic.json`. Every CLI-specific config
(`opencode.json`, `GEMINI.md`, `CLAUDE.md`, etc.) is generated from it by
`./.agents/bootstrap.sh <cli>` and is **gitignored** — each developer regenerates
their own after cloning.

---

## Slash Commands Available

| Slash command | Purpose |
|---|---|
| `/init` | Set up the project (one-time scaffold lifecycle). The agent does it. |
| `/status` | Show project state (active feature, specs pending, last progress). |
| `/spec` | Create the spec for the first `pending` feature with `"sdd": true`. |
| `/approve` | Approve a `spec_ready` feature and flip it to `in_progress`. |
| `/implement` | Execute `tasks.md` for the feature in `in_progress`. |
| `/done` | Run the reviewer, verify R↔test traceability, mark `done` if green. |
| `/check` | Shortcut to `./check.sh`. |

These commands call the shared gates in [the workflow contract](workflow-contract.md), including optional team-policy enforcement.

---

