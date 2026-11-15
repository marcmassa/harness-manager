# Quality checks

Run `./check.sh` from a checkout or exported project. Python 3 and Bash are
required. Each project check reports PASS, FAIL, or SKIP and identifies whether
it is required or optional. Applicable required failures or missing required
tools make the final exit code nonzero. Optional missing tools report SKIP;
optional failing checks report FAIL but do not block. Missing project suites
in an exported consumer are reported separately from passing tests.

Python syntax is compiled in memory without creating bytecode. Virtualenvs,
node_modules, vendor, build artifacts, and Git metadata are excluded. A tests/
directory does not imply pytest. Pytest runs when its configuration is present;
a missing configured pytest module is a required failure. Framework suites use
standard-library unittest and Bash launchers.

Terraform sources require terraform format/validate; tflint is optional. Helm
charts require helm lint. A go.mod requires build/vet/tests. npm build/test run
only when their scripts are declared. Missing required executables block.

Additional checks can be declared in `.agents/agentic.json`:

```json
{
  "quality_checks": [
    {"id": "application-tests", "command": ["python3", "-m", "unittest", "discover"], "required": true},
    {"id": "optional-linter", "command": ["custom-linter"], "required": false}
  ]
}
```

Commands are argument arrays, executed without a shell from the project root.
Identifiers must be unique. `required` defaults to true. Do not put secrets in
arguments or expect shell expansion. Optional means nonblocking, not hidden.

The `--py-only`, `--ts-only`, and `--go-only` flags select built-in project stack
checks; explicitly declared checks still run. `--spec-only` skips project checks
but retains framework validation and infrastructure suites.

CI uses the same token policy as the pre-commit hook, reading immutable candidate
blobs and attributes. Pull requests compare merge-base to candidate; pushes use
before/after; an initial push explicitly validates the candidate tree. Invalid
revision inputs fail. Existing unchanged oversized files are grandfathered in
normal diffs. Details: [token policy](../.githooks/README.md).

Workflow reference: [GitHub's Python CI guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/python).
Actual remote runs and required branch checks are distinct from the existence
of a workflow file; no remote CI success is claimed by local test output.

## Context budget

Agents pay for every byte they load at session start, and state files grow
with the project. The session path is therefore two commands:

| Command | Replaces | Output |
|---|---|---|
| `./check.sh --quiet` | `./check.sh` | Warnings and one result line; full output only on failure. Same checks and exit code. |
| `./.agents/bootstrap.sh brief` | Reading `feature_list.json`, `tasks.md`, and `progress/current.md` | About 1 KB: feature counts, the active feature and its next task, features awaiting approval, the live session state. Its size does not grow with closed features. |

The brief also warns when a file exceeds its budget:

| File | Budget | Why |
|---|---|---|
| `AGENTS.md` | 8 KB | Loaded every session |
| `progress/current.md` | 3 KB | Loaded every session; live state only, replaced not appended |
| `progress/handoff.md` | 8 KB | Loaded every session where a project uses it |
| `progress/progress.md`, `history.md`, `decisions.md` | 20 KB | Logs: search or read the tail, never the whole file. Same limit as the staged-file hook |

Override or add budgets (bytes) with an optional `context_budget` object in
`.agents/agentic.json`, for example `{"DESIGN.md": 12000}`.

`./.agents/bootstrap.sh archive-log progress/<file>.md` moves an oversized log
to `progress/archive/<name>-<date>.md` and leaves a stub that points to it.
Nothing is deleted.
