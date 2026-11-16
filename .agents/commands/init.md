# /init

Shape the Harness SDD manifest for this project. Run once, right after
installing the template, when `./.agents/bootstrap.sh init` shows `FRESH`.
The agent does the work; the human confirms the two decisions marked **ASK**.
To add a sub-agent later, edit `subagents[]` and run `./.agents/bootstrap.sh --all`
instead of re-running `/init`.

## Completion gate

`/init` is done only when both exit 0. Loop until they do; never report
success otherwise.

```bash
./.agents/bootstrap.sh init --validate
./check.sh --quiet
```

The validator requires: `subagents[]` non-empty with the schema in step 3, no
scaffold metadata in it, every `role_file` and `SOUL.md` on disk, and the
`_template_*` scaffolds and `_template_lifecycle` removed.

## Step 0 — Declare the CLIs in use (**ASK**)

```bash
./.agents/bootstrap.sh detect --clis
```

Propose the CLIs reported `present` (default `opencode` if none) and ask the
human which ones the project uses. Write the confirmed list, then prune:

```bash
python3 - <<'PY'
import json
p = ".agents/agentic.json"; m = json.load(open(p))
m["target_clis"] = ["opencode"]   # the confirmed list
json.dump(m, open(p, "w"), indent=2, ensure_ascii=False); open(p, "a").write("\n")
PY
./.agents/bootstrap.sh clean
```

Never render adapters for a CLI the human did not confirm. A CLI without a
prebuilt adapter is handled through `.agents/BOOTSTRAP.md`.

## Step 1 — Learn the project

```bash
./.agents/bootstrap.sh init      # must show State: FRESH; otherwise ask the human
./.agents/bootstrap.sh profile   # scaffolds available and which match this project
```

Read the project's `README.md` and list its top-level layout. Do not guess the
stack: if the language or framework is unclear, ask.

## Step 2 — Plan the sub-agents (**ASK**)

Show a plan and wait for confirmation, for example:

```
harness      → harness-acme        (orchestrator)
spec-author  → spec-author-acme
implementer  → python-implementer  (file_glob: **/*.py)
reviewer     → reviewer-acme
```

- Always include the four canonical roles (renamed or not).
- One implementer per language, never per file or feature.
- Add an illustrative scaffold only if the project has that work. Prefer fewer
  agents; adding one later is easy.

## Step 3 — Build each sub-agent

Open `.agents/agentic.json` once. For each planned agent, copy its scaffold
from `_template_subagents_examples[]` into `subagents[]` and customize it:

```json
{
  "name": "python-implementer",
  "mode": "subagent",
  "description": "What this agent does in THIS project",
  "role_file": ".agents/subagents/python-implementer/SUBAGENT.md",
  "soul": ".agents/subagents/python-implementer/SOUL.md",
  "default": true,
  "applies_when": {"file_glob": ["**/*.py"]},
  "permission": {"edit": {"specs/**": "deny", "**/*.py": "allow", "*": "ask"}}
}
```

| Field | Rule |
|---|---|
| `name` | Required. Project-specific, not the scaffold's name. |
| `mode` | Required. `primary` for the orchestrator, `subagent` otherwise. |
| `description` | Required. Rewritten for this project, never the scaffold text. |
| `role_file` | Required. `.agents/subagents/<name>/SUBAGENT.md`. |
| `permission` | Required. Always includes `"specs/**": "deny"`; when unsure use `"ask"`. |
| `default`, `applies_when` | Optional. `applies_when` patterns are AND-combined. |

- **Forbidden** in `subagents[]`: `_lifecycle`, `_intent`, `category`. They
  belong to scaffolds only; remove them from every copied entry.
- `SUBAGENT.md` is auto-scaffolded from `.agents/subagents/agent-template/` on
  render if missing. It is a template: customize it.
- Every agent needs a `SOUL.md` with real content in four sections: Identity
  (who it is and why), Decision Principles (ordered), Boundaries (hard
  limits), Tone & Style. Copy `agent-template/SOUL.md` and replace every
  placeholder.
- `./.agents/bootstrap.sh add-agent <name> --yes` borrows a scaffold verbatim.
  Use it only to try the framework, not for a real project.

## Step 4 — Drop the scaffolds

```bash
./.agents/bootstrap.sh remove-examples --yes   # also re-renders the adapters
./.agents/bootstrap.sh init                    # must show State: INITIALIZED
```

Your `subagents[]` entries are untouched. If the state is still `PARTIAL` or
`FRESH`, re-run and read the output.

## Step 5 — Pass the gate, then report

Run the two gate commands above. When both pass, report in a few lines: the
confirmed CLIs, each sub-agent built and the scaffold it came from, the
scaffolds removed, and both gate results. If anything failed, report the
failure instead. Next step for the human: `/spec` on a pending feature.

## Common mistakes

- Leaving the scaffold description, or scaffold metadata, in `subagents[]`.
- Skipping `remove-examples`, or declaring done without running the gate.
- Writing a sub-agent from scratch instead of customizing a scaffold.
- Editing `agentic.json` afterwards without `./.agents/bootstrap.sh --all`.
- Leaving placeholder text in a `SOUL.md`.

Background: `AGENTS.md §0.5`, `AGENTS.md §1`, and
`docs/framework-workflow.md` ("Template Installation Lifecycle").
