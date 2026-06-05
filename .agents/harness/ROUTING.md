# Agent Routing Decision Tree — Harness SDD

## Decision Tree

```
START: New Task Received
        │
        ▼
┌────────────────────────────────────────────┐
│ Is this an SDD spec/feature task?          │
│ (spec, sdd, feature_list, requirements,   │
│  design, tasks, ears, traceability)        │
└──────────────────┬─────────────────────────┘
                   │
            ┌──────┴──────┐
            │ Yes         │ No
            ▼             ▼
     ┌─────────────────────────────────────────┐
     │ Check feature_list.json status:        │
     │                                        │
     │ pending → spec_author (quality-agent)  │
     │          → create specs/<feature>/     │
     │          → mark spec_ready → STOP      │
     │                                        │
     │ spec_ready → WAIT for human approval   │
     │                                        │
     │ in_progress → implementer + reviewer   │
     │               → run tasks.md           │
     │               → check.sh → done        │
     └─────────────────────────────────────────┘
                          │
                          ▼
             [Return to normal task routing]
                          │
                          ▼
┌────────────────────────────────────┐
│ Is this infrastructure / IaC?     │
│ (Terraform, Helm, K8s, Cloud)     │
└──────────────┬─────────────────────┘
               │
         ┌─────┴─────┐
         │ Yes       │ No
         ▼           ▼
  ┌────────────┐  ┌────────────────────┐
  │ cloud-     │  │ Is this testing?  │
  │ architect  │  │ (pytest, terratest)│
  │ + platform │  └────────┬───────────┘
  │ engineer   │           │
  └──────┬─────┘      ┌────┴────┐
         │            │ Yes    │ No
         │            ▼        ▼
         │      ┌────────┐ ┌──────────────────┐
         │      │ tester │ │ Is this docs/    │
         │      │ -agent │ │ handoff?         │
         │      └────────┘ └────────┬─────────┘
         │                          │
         │                     ┌────┴────┐
         │                     │ Yes    │ No
         │                     ▼        ▼
         │               ┌────────┐ ┌────────────┐
         │               │ escriba│ │ quality-   │
         │               └────────┘ │ agent      │
         │                          │ (review)   │
         │                          └────────────┘
         ▼
  ┌────────────────┐
  │ + quality-agent│
  │ + tester       │
  └────────────────┘
```

## Subagent Definitions

> **Note:** The sub-agents listed in the decision tree (`cloud-architect`, `platform-engineer`, `tester-agent`, `security-reviewer`, `escriba`, `quality-agent`) are **illustrative**. The four canonical sub-agents that ship with this template live in `.agents/subagents/{harness,spec-author,implementer,reviewer}/`.
>
> To activate any illustrative agent, scaffold it first by copying `.agents/subagents/agent-template/` to `.agents/subagents/<name>/` and editing the `SUBAGENT.md`. Then add it to `.agents/agentic.json` and re-run `./.agents/bootstrap.sh <cli>`.

Each canonical sub-agent uses a dual frontmatter (CLI-agnostic fields + opencode-compatible fields):

```yaml
---
name: <name>             # CLI-agnostic identifier
type: subagent           # legacy/agnostic
user-invocable: true     # legacy/agnostic
description: "..."       # opencode-compatible (required)
mode: subagent           # opencode-compatible (required for delegation)
model-agnostic: true     # legacy/agnostic
---
```

opencode-compatible fields are honored by opencode; legacy/agnostic fields are
silently routed into `options` by opencode and read by other CLIs (gemini-cli,
claude-code) when they pick up the manifest.

## Skills

**Skills** (in `.agents/skills/`) are add-ons that agents can load to acquire
specific knowledge or specialized workflows without creating a new full sub-agent.

## Routing Matrix

| Task Type | Keywords | Primary Agent | Secondary Agents |
|-----------|----------|---------------|------------------|
| **SDD Spec** | spec, sdd, requirements, design, tasks, ears, feature_list | `spec-author` | — |
| **SDD Implementation** | implement, code, after approval | `implementer` | `reviewer` |
| **Infra / IaC** | terraform, helm, k8s, cloud, aws, gcp, azure, vpc, eks, aks, gke | `cloud-architect` + `platform-engineer` (illustrative) | `quality-agent`, `tester-agent` |
| **Testing** | test, coverage, terratest, pytest, verification | `tester-agent` (illustrative) | `quality-agent` (illustrative) |
| **Security / Compliance** | security, policy, compliance, soc2, hipaa, network policy | `security-reviewer` (illustrative) | `quality-agent` (illustrative) |
| **Documentation** | docs, readme, progress, handoff, runbook | `escriba` (illustrative) | `quality-agent` (illustrative) |
| **General** | Any other task | `harness` (default orchestrator) | (depends on specifics) |
