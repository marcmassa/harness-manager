# /init

Set up the Harness SDD framework for this project. **The agent does the
work; the human supervises.** This is a one-time command that runs at
the start of a project, before any SDD work on individual features.

This is the **meta-workflow** (3 stages, SCAFFOLD → IMPLEMENT → REMOVE).
After `/init`, the project follows the per-feature SDD workflow
(`/spec` → `/approve` → `/implement` → `/done`).

---

## COMPLETION GATE (READ FIRST)

Before you declare `/init` done, **every** condition below must be true.
If any is false, fix it and re-run. Do NOT report success otherwise.

- [ ] `subagents[]` is non-empty (it has the project's sub-agents).
- [ ] `_template_subagents_examples[]` is **empty** (scaffolds dropped).
- [ ] `_template_lifecycle` is **absent** from the manifest.
- [ ] Every entry in `subagents[]` has the schema below (no scaffold
      metadata leaked: no `_lifecycle`, no `_intent`, no `category`).
- [ ] `./check.sh` exits 0.

The objective check is: **`./.agents/bootstrap.sh init --validate`**.
Run it. It MUST exit 0. If it exits 1, read the errors, fix them,
re-run. **Loop until it exits 0**. Only then is `/init` complete.

---

## WHEN TO RUN

Run `/init` exactly once per project, right after copying the template,
when `./.agents/bootstrap.sh init` shows:

> State: FRESH — subagents[] is empty, 7 scaffolds in
> _template_subagents_examples[]

If you have already run `/init` once and want to **add** a new
sub-agent later (e.g. the project adopted Terraform), do not re-run
`/init`. Instead, manually add a new entry to `subagents[]` in
`.agents/agentic.json` and run `./.agents/bootstrap.sh --all` to
re-render.

---

## STEP 1 — Pre-flight check (run these commands, do not skip)

**RUN, do not paraphrase:**

```bash
./.agents/bootstrap.sh init    # see current state and scaffolds
cat .agents/agentic.json       # read the manifest
ls -la                         # see the project layout
cat README.md 2>/dev/null      # what is this project
cat feature_list.json 2>/dev/null
```

**STOP. Verify before continuing:**

- Did the output show `State: FRESH`? (If not, abort and ask the human.)
- Did you see the 7 scaffolds (4 canonicals + 3 illustrative)?
- Do you understand what this project does (language, framework, stack)?

If any answer is no, ask the human. **Do not guess the project's stack.**

---

## STEP 2 — Decide which sub-agents this project needs (write the plan)

**WRITE a plan, do not skip.** List the sub-agents this project needs,
in a single block of text. Example plan for a Python+React project:

```
PLAN:
- harness         → harness-acme (SDD orchestrator, customized)
- spec-author     → spec-author-acme (EARS, customized)
- implementer     → python-implementer (file_glob: **/*.py)
- reviewer        → reviewer-acme (customized)
- frontend-specialist → kept as frontend-specialist (file_glob: **/*.tsx)
```

Rules for the plan:

- **Always** include the 4 canonicals (harness, spec-author,
  implementer, reviewer) — renamed or as-is, but always present.
- **Add** illustrative agents only if the project actually has that
  work (e.g. no `*.tf` files → no `cloud-architect`).
- **Default to a smaller set** over a larger set. Easy to add an agent
  later, hard to remove one in use.
- **One implementer per language** is the right granularity. Do NOT
  create one implementer per file or per feature.

**STOP. Show the plan to the human and wait for confirmation.** The
human can override, add, or remove entries before you proceed.

---

## STEP 3 — Build each sub-agent (this is where most agents fail)

You will build each sub-agent by **copying a scaffold from
`_template_subagents_examples[]` into `subagents[]` and customizing it**.
You MUST follow the **scaffold schema** below for every entry. If you
do not, the completion gate will reject your init.

### 3a. The scaffold schema (REQUIRED structure for every sub-agent in `subagents[]`)

Each entry in `subagents[]` MUST have this exact shape. **No exceptions.**

```json
{
  "name": "<project-specific-name>",
  "mode": "primary | subagent",
  "description": "<WHAT THIS AGENT DOES IN YOUR PROJECT — not the scaffold description>",
  "role_file": ".agents/subagents/<name>/SUBAGENT.md",
  "default": true,
  "applies_when": {
    "file_glob": ["**/*.py"],
    "file_exists": ["pyproject.toml"]
  },
  "permission": {
    "edit": {
      "specs/**": "deny",
      "**/*.py": "allow",
      "tests/**/*.py": "allow",
      "*": "ask"
    }
  }
}
```

Field rules:

| Field          | Required | Rule |
|----------------|----------|------|
| `name`         | YES      | Project-specific. NOT the scaffold name. e.g. `python-implementer`, not `implementer`. |
| `mode`         | YES      | `"primary"` for the orchestrator, `"subagent"` for everything else. |
| `description`  | YES      | REWRITE — do not copy the scaffold description verbatim. State what the agent does in YOUR project. |
| `role_file`    | YES      | Path to `SUBAGENT.md`. Defaults to `.agents/subagents/<name>/SUBAGENT.md`. |
| `default`      | NO       | `true` = always active. `false` = opt-in via `applies_when`. |
| `applies_when` | NO       | `{file_glob: [...], file_exists: [...]}`. AND-combined. Omit for always-on. |
| `permission`   | YES      | `{edit: {<glob>: <allow\|deny\|ask>, ...}}`. Always include `specs/**: deny`. |

### 3b. FORBIDDEN fields in `subagents[]` (these belong to scaffolds only)

If any of these appear in a `subagents[]` entry, the validation gate
**rejects the init**:

- `_lifecycle` — only in `_template_subagents_examples[]`. **Remove it.**
- `_intent` — only in `_template_subagents_examples[]`. **Remove it.**
- `category` — only in `_template_subagents_examples[]`. **Remove it.**

### 3c. Two ways to build each sub-agent

**Option A — Borrow as-is (only for evaluation, NOT for production):**

```bash
./.agents/bootstrap.sh add-agent <name> --yes
```

This copies the scaffold, strips `_lifecycle`/`_intent`/`applies_when`,
sets `default: true`. The result still has the scaffold's description
verbatim. Only use this to test the framework; do not use it for
production projects.

**Option B — Customize (REQUIRED for production projects):**

Edit `.agents/agentic.json` by hand. For each sub-agent in your plan:

1. Copy the matching entry from `_template_subagents_examples[]` to
   `subagents[]` (top-level array).
2. **Customize the fields** per the table above. At minimum:
   - Change `name` to your project-specific name.
   - **Rewrite `description`** in your project's terms. Do not copy
     verbatim.
   - Adjust `permission` to your project's needs.
   - Adjust `applies_when.file_glob` to your project's file types.
3. **Remove** the forbidden fields (`_lifecycle`, `_intent`, `category`).
4. Create or update the `SUBAGENT.md` at the new `role_file` path.
   The renderer will auto-scaffold it from
   `.agents/subagents/agent-template/` if it is missing. **Read the
   auto-scaffolded file and customize it** — it is a template, not a
   finished role definition.

### 3d. STOP. Verify after building all sub-agents.

Before continuing to STEP 4, run this and check the output:

```bash
python3 -c "
import json
m = json.load(open('.agents/agentic.json'))
print('=== subagents[] ===')
for a in m['subagents']:
    forbidden = [k for k in ['_lifecycle', '_intent', 'category'] if k in a]
    marker = '  !! ' if forbidden else '  OK '
    print(f'{marker}{a[\"name\"]:<24} mode={a.get(\"mode\",\"?\"):<10} role_file={a.get(\"role_file\",\"MISSING\")}')
    if forbidden:
        print(f'      FORBIDDEN fields present: {forbidden}')
print()
print('Scaffolds still in _template_subagents_examples[]:', len(m.get('_template_subagents_examples', [])))
"
```

**STOP. All entries must show `OK` (no `!!` markers).** If any
sub-agent has forbidden fields, fix it before continuing.

---

## STEP 4 — Drop the scaffolds (do not skip this step)

Once all sub-agents in `subagents[]` pass the check in 3d, run:

```bash
./.agents/bootstrap.sh remove-examples --yes
```

This:

- Removes `_template_subagents_examples[]` (the 7 scaffolds).
- Removes `_template_lifecycle` (the lifecycle intent documentation).
- Re-renders all CLI adapters.
- **Leaves `subagents[]` untouched** (your custom sub-agents stay).

**STOP. Verify after running:**

```bash
./.agents/bootstrap.sh init
```

The output MUST show:

> State: INITIALIZED — subagents[] has N project-specific entries,
> no scaffolds remain.

If it shows `PARTIAL` or `FRESH`, the remove-examples command did not
finish. Re-run with `--yes` and check the output.

---

## STEP 5 — Verify (the gate)

Run:

```bash
./.agents/bootstrap.sh init --validate
./check.sh
```

**Both MUST exit 0.** If either exits 1, fix the issue and re-run.

`init --validate` checks:

- `subagents[]` is non-empty.
- `_template_subagents_examples[]` is empty.
- `_template_lifecycle` is absent.
- Every entry in `subagents[]` has the required schema (see STEP 3a).
- No entry in `subagents[]` has the forbidden fields (see STEP 3b).
- Every `role_file` points to an existing `SUBAGENT.md` on disk.

`./check.sh` checks the broader environment: JSON validity, adapter
consistency, sub-agent consistency, spec validation, etc.

**If either fails, you are not done. Loop until both pass.**

---

## STEP 6 — Report to the human

Tell the human exactly what you did. Be specific. Use this format:

```
=== /init — report ===

State before: FRESH (subagents[] empty, 7 scaffolds)
State after:  INITIALIZED

Sub-agents built (N entries in subagents[]):
  - harness-acme           (customized from harness, name+description rewritten)
  - spec-author-acme       (customized from spec-author, project permissions)
  - python-implementer     (customized from implementer, file_glob: **/*.py)
  - reviewer-acme          (customized from reviewer, project permissions)

Scaffolds dropped:
  - 7 entries removed from _template_subagents_examples[]
  - _template_lifecycle removed

SUBAGENT.md files created/updated:
  - .agents/subagents/harness-acme/SUBAGENT.md      (customized)
  - .agents/subagents/spec-author-acme/SUBAGENT.md  (customized)
  - .agents/subagents/python-implementer/SUBAGENT.md (customized)
  - .agents/subagents/reviewer-acme/SUBAGENT.md     (customized)

Validation:
  - ./bootstrap.sh init --validate: PASS
  - ./check.sh: PASS

The project is now shaped. Next: run /spec on a pending feature.
```

If anything failed, **report the failure**, do not declare success.

---

## COMMON MISTAKES (do not make these)

- **Mistake 1: Borrowing as-is for production.** `add-agent --yes`
  keeps the scaffold description verbatim. Production projects need
  customized descriptions and permissions. Use Option B.
- **Mistake 2: Leaving scaffold metadata in `subagents[]`.** Fields
  like `_lifecycle`, `_intent`, `category` belong to
  `_template_subagents_examples[]` only. If you copied an entry,
  remove them.
- **Mistake 3: Forgetting to run `remove-examples`.** The scaffolds
  are still in the manifest. The completion gate catches this, but
  only if you run it.
- **Mistake 4: Skipping `./check.sh`.** The init is not done until
  `./check.sh` is green. Always run it.
- **Mistake 5: Creating sub-agents from scratch instead of copying
  scaffolds.** The whole point of the scaffold model is that you
  customize a known-good pattern. Creating a sub-agent from scratch
  loses the framework's accumulated knowledge.
- **Mistake 6: Adding too many sub-agents.** One implementer per
  language. One orchestrator. Add illustratives only if the project
  has that work.
- **Mistake 7: Declaring done without re-rendering.** After editing
  `agentic.json`, run `./.agents/bootstrap.sh --all` to regenerate
  the CLI adapters. If you skip this, the changes are not visible
  to the agent at runtime.

---

## IF YOU ARE UNSURE

- **Unsure which sub-agents the project needs** → ask the human.
  Default to fewer agents; add later if needed.
- **Unsure how to customize a field** → look at the scaffold's
  `_intent` field in `_template_subagents_examples[]` for guidance.
- **Unsure if the init is complete** → run
  `./.agents/bootstrap.sh init --validate`. If it exits 0, you are
  done. If not, fix and re-run.
- **Unsure about a permission value** → default to `"ask"` (safer
  than `"allow"`).

---

## RELATED

- `AGENTS.md §0.5` — Project Profiling (3-stage lifecycle).
- `AGENTS.md §1` — Mandatory pre-task checklist.
- `.agents/agentic.json#_template_lifecycle` — the lifecycle intent
  in the manifest.
- `bootstrap.sh init --validate` — objective completion gate.
- `bootstrap.sh profile` — see the lifecycle state.
- `bootstrap.sh add-agent <name> --yes` — borrow a scaffold as-is.
- `bootstrap.sh remove-examples --yes` — drop the scaffolds.
