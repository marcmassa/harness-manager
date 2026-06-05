---
name: agent-template
type: subagent
user-invocable: true
description: "Example sub-agent that serves as a template for implementing more sub-agents. Includes the right structure and format: dual frontmatter, mission, tasks, tools, rules, guidelines, integration, and workflow."
mode: subagent
model-agnostic: true
---

## Mission
[Describe here the fundamental purpose of this sub-agent: what problem it solves, what area of the project it covers, and why it is needed.]

## Main tasks

1. **[Area 1 — Descriptive name]**:
   - [Concrete and measurable action 1].
   - [Concrete and measurable action 2].
   - [Concrete and measurable action 3].

2. **[Area 2 — Descriptive name]**:
   - [Concrete and measurable action 1].
   - [Concrete and measurable action 2].

3. **[Area 3 — Descriptive name]**:
   - [Concrete and measurable action 1].
   - [Concrete and measurable action 2].
   - [Concrete and measurable action 3].

4. **[Area 4 — Descriptive name]**:
   - [Concrete and measurable action 1].

## Available tools
- `[path/file]` — [Description of when and how to use it]
- `[path/file]` — [Description of when and how to use it]
- `[path/file]` — [Description of when and how to use it]

## Style rules
- **Harness Compliance**: This agent operates under the **Harness SDD** framework. It must always consult `AGENTS.md`, `feature_list.json` and `progress/current.md` before acting.
- **Modular Skills**: It must not reinvent standard workflows. It must verify the existence of skills in `.agents/skills/` and, if they don't exist, sync them using `./.agents/skills/sync-skills.sh`.
- **[Rule 3]**: [Description of the rule and how to apply it].

## Guidelines
- **Harness First**: Every action must be traceable in the SDD and validated via `./check.sh`.
- **Skills Oriented**: If the task involves standard technologies (Terraform, K8s, Cloud), prioritize the use of the instructions defined in the downloaded *skills*.
- [Guideline 3: important behavior or restriction].

## Integration with other sub-agents
- **[Other sub-agent]**: [How they collaborate, what information they exchange, in what order they work].
- **[Other sub-agent]**: [How they collaborate, what information they exchange, in what order they work].

## Workflow
1. [Step 1 of the typical workflow].
2. [Step 2 of the typical workflow].
3. [Step 3 of the typical workflow].
4. [Step 4 of the typical workflow].
5. [Step 5 of the typical workflow].

---

*Copy this entire directory (`.agents/subagents/agent-template/`) as a base to create new sub-agents. Rename the folder and adjust the YAML frontmatter fields, mission, tasks, and the rest of the sections according to the new agent's role.*
