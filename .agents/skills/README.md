# Skills

This directory contains the agent **skills** (capabilities). To keep the template
agnostic, skills are managed centrally in the
[Agent Skills Registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git).

## How to obtain/update skills

Run the sync script to download the latest versions of the standard skills:

```bash
./.agents/skills/sync-skills.sh
```

## Purpose

Skills let agents extend their capabilities through:

- **Specialized workflows:** Detailed instructions for common tasks.
- **Tool integrations:** Configurations to interact with specific tools.
- **Domain knowledge:** Guides on architecture, conventions, or particular technologies.

## Structure

Each skill resides in its own subdirectory, containing a `SKILL.md` file with
its instructions and resources.

## Discovery by CLI adapters

- **opencode:** auto-discovers `**/SKILL.md` inside any directory listed in `opencode.json` → `skills.paths`. The default adapter points to `.agents/skills/`.
- **gemini-cli:** reads skills from a configured skills path or via `GEMINI.md` content.
- **claude-code:** auto-discovers `**/SKILL.md` under `.claude/skills/`. The claude-code adapter documents how to symlink or copy from `.agents/skills/`.
- **other CLIs:** consult `.agents/BOOTSTRAP.md`.
