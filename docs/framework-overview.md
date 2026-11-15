# Framework overview

## The Problem

Without an explicit harness, AI agent interactions follow a recognizable pattern:

```
Human: "Add support for X"
Agent: (writes code without full context)
       (skips steps, assumes non-existent conventions)
       (leaves repo in an indeterminate state)
Human: (reviews, finds errors, asks for changes)
Agent: (iterates without memory of the previous iteration)
       → Frustration, wasted time, inconsistent code
```

The root cause is not the agent's capability — it is the absence of structure. The agent has no declared source of truth, no explicit workflow to follow, and no persistent memory between sessions.

### The Solution

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

→ Full traceability. Human approval and technical review remain explicit team responsibilities.
```

---

## Impact

| What you get | How the framework enforces it |
|---|---|
| **Human approval and review** | Agent instructions require spec approval; repository review controls are configured separately |
| **Requirement traceability** | Reviewers currently check R↔test evidence; automatic completeness validation is planned in FEAT-010 |
| **Persistent session context** | `AGENTS.md` + `feature_list.json` + `progress/current.md` give a new agent full project state |
| **Portable configuration** | One manifest drives five supported adapter entry points; capabilities differ by CLI |
| **Any stack, any language** | Stack-aware only via `project_detect[]` — the framework itself is technology-agnostic |
| **Customizable agent behavior** | Steering files tune per-role directives; lifecycle hooks automate SDD transitions |
| **Repeatable process** | Every feature, every sprint, every team member follows the same spec→approve→implement→done flow |

---

