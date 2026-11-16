# Skills

This directory contains the agent **skills** (capabilities). To keep the template
agnostic, skills are managed centrally in the
[Agent Skills Registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git).

## How to obtain/update skills

Run the sync script to download the latest versions of the standard skills:

```bash
./.agents/skills/sync-skills.sh
```

Skills are instructions that agents follow, so pin the registry to a commit
you have reviewed. In `.agents/agentic.json`:

```json
"skills": {"paths": [".agents/skills"], "registry": {"url": "<git url>", "ref": "<40-hex commit>"}}
```

`SKILLS_REGISTRY_URL` and `SKILLS_REGISTRY_REF` override it. With a `ref`, the
sync installs exactly that commit or changes nothing. Without one it uses the
default branch and prints the commit to pin. A download that fails, has no
`skills/` directory, or contains symbolic links leaves the current skills untouched.

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
