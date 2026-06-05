# Harness SDD — Sub-Agent System

Specialized sub-agents that work on project features following the SDD process.

## Agent Architecture

```
                      ┌──────────────────────┐
                      │      HARNESS         │
                      │   (orchestrator)     │
                      └────────┬─────────────┘
                               │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │  SPEC_AUTHOR   │ │  IMPLEMENTER   │ │  REVIEWER      │
     │  (quality)     │ │  (orchestrator)│ │  (quality)     │
     └────────────────┘ └────────────────┘ └────────────────┘
```

## Sub-agents

Each sub-agent is defined in `.agents/subagents/<name>/SUBAGENT.md` with a dual
frontmatter (CLI-agnostic fields + opencode-compatible fields). Sub-agents can
extend their capabilities through **skills** stored in `.agents/skills/`.

| Agent | SUBAGENT.md | Responsibility |
|--------|-------------|----------------|
| `harness` | `.agents/subagents/harness/SUBAGENT.md` | Default orchestrator. Routes work across sub-agents. |
| `spec-author` | `.agents/subagents/spec-author/SUBAGENT.md` | Produces specs in EARS notation. Never writes production code. |
| `implementer` | `.agents/subagents/implementer/SUBAGENT.md` | Executes `tasks.md` sequentially on the active feature. |
| `reviewer` | `.agents/subagents/reviewer/SUBAGENT.md` | Verifies R<n>↔test traceability and runs `./check.sh`. |
| `agent-template` | `.agents/subagents/agent-template/SUBAGENT.md` | **Example template** — copy to create new sub-agents. |

*To add a new sub-agent, copy `.agents/subagents/agent-template/`, rename the folder and edit the SUBAGENT.md.*

## Routing

See `ROUTING.md` for the full decision tree.
See `workflows.md` for predefined workflows.
See `CONVENTION.md` for the mandatory usage convention.
