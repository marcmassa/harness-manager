# Verifiable workflow contract

Shared gates behind `/spec`, `/approve`, `/implement`, `/done`, and `./check.sh`.
They establish that records are complete, current, and consistent. They do not
prove that a person made a decision, or that a test is a good test.

## Opting in

Projects without `team_policy` in `.agents/agentic.json` keep structural gates
only: valid transitions, spec artifacts, concurrency, and finished tasks. Results
are labeled `no-team-policy-structural-gates-only`, and `check.sh` reports `[SKIP]`.
When an SDD feature moves to `in_progress`, the digest of `requirements.md` and
`design.md` and the task-structure digest of `tasks.md` are stored on the
feature as `spec_approval`. While the feature is `in_progress`, `check.sh` and
the `done` transition fail if those files change beyond `[x]` markers. After a
human approves a changed spec, `workflow-approve --reviewer --evidence-ref`
rebinds it. This is a declared record, not authentication, and features that
started before this check have no `spec_approval` and are not verified.

Blocking stores `blocked_from` on the feature, and blocked work returns only to
that status. A feature blocked by hand has no origin, so it returns to `pending`
(or `spec_ready` for SDD work) and passes the gates again.

To opt in:

1. Copy `docs/team-policy/example.json` to a project-owned path and map the roles
   to your team. The example path itself is refused as an active policy.
2. Have a human review `docs/team-policy/scenarios.json`. Set each `human_review`
   and create the decision record it cites (see `docs/team-policy.md`).
3. Set `team_policy` and `team_policy_scenarios` in `.agents/agentic.json`.
4. List features already closed before adoption in the policy's
   `historical_features`, and set `adoption_revision` to a commit made before
   `team_policy` was activated. Each listed feature must have been `done` in
   that commit's `feature_list.json` and still be `done`. Every other feature
   at `in_progress` or `done` needs a work record. Before opting in, finish or
   return in-progress features to `spec_ready`: records are created only for
   `pending` or `spec_ready` work.

Exported copies start with `human_review: null`, so a maintainer's acceptance
never becomes a consumer's default.

## Records

One record per active feature at `progress/work/<feature-name>.json`, in the
format of `.agents/schemas/work-record.json`. Its `spec_dir` must be
`specs/<feature-name>`, so approval cannot target another feature's spec.
Unknown `format_version` values are refused with a migration diagnostic.

| Step | Command (each prefixed `./.agents/bootstrap.sh`) |
|---|---|
| Create record | `workflow-init` (lightweight: `--classified-by`, `--classification-ref`, `--no-high-risk`) |
| Record human spec decision | `workflow-approve` |
| Record scope change | `workflow-scope-change` |
| Move state | `workflow-transition` (`workflow-validate` for a dry run) |
| Add requirement evidence | `workflow-evidence` (`workflow-evidence-remove` retires an entry) |
| Run and record `check.sh` | `workflow-run-checks` |
| Record closing review | `workflow-review` |
| Run a review/implementation hook | `workflow-run-hook` |
| Continue after failed hook | `workflow-recover` |
| Undo interrupted mutation | `workflow-rollback` |
| Validate everything | `workflow-check` |

Commands take no option for an alternate record, policy, or attestation file.

A closed feature's evidence is checked in the blobs of its closure revision, so
renaming or deleting its tests in a later commit does not invalidate it.

A record is created once. If a committed record is deleted, `workflow-check`
fails and `workflow-init` refuses to replace it; restore it from Git.

Every mutation holds `progress/work/.workflow.lock`, reads the files it
validates under that lock, and writes only if they still hold the text it read.
State files and their parent directories are opened without following
symlinks, so `progress` or `progress/work` pointing elsewhere is refused for
reads, writes, the journal, and rollback.

## Approval binding

The digest is SHA-256 over a version prefix and length-prefixed raw bytes of
`requirements.md` then `design.md`; `spec-digest` prints it. Any byte change
requires reapproval. Separately, `tasks.md` is hashed with checkbox markers
blanked: marking progress preserves approval, while changing task text needs
`workflow-scope-change` by a human `scope` authority. A scope change marked
`required` demands a new approval rather than covering the difference.

## Closure

Completion requires, for HEAD with a working tree matching it (`progress/` and
`feature_list.json` excepted because they hold the workflow state):

- current approval, an `approved_revision` that is an ancestor of HEAD;
- every `T<n>` checked, with unparseable or bare task lines rejected;
- for every `R<n>`, evidence at HEAD: automated as `path::test_symbol`, where
  the path is `test_*.py`, `*_test.py`, `test_*.sh` or `*_test.sh` and the
  symbol is a `test*` function or method (Python, via AST) or a `test*` shell
  function in that commit's blob; or manual with a human reviewer who is not
  the owner. Recording evidence for a new HEAD moves entries for older commits
  to `superseded_evidence`;
- a passing `check.sh` entry for HEAD; `workflow-run-checks` executes it;
- an approved closing review for HEAD from a human other than the owner.

Evidence sources are resolved inside the repository; symlink escapes fail.
Evidence `result` values and reviewer names are declared by whoever runs the
command. Only the `check.sh` result is observed by the tooling.

## Assurance levels

| Label | Meaning |
|---|---|
| `no-team-policy-structural-gates-only` | No approval or review is recorded |
| `declared-local-decision` | Someone recorded a human decision; not authenticated |
| `pending-trusted-verification` | Repository mode, checked locally; not yet authenticated |
| `provider-verified` | Produced only in memory by the trusted CI verifier |

## Repository review mode

`review_mode: "repository"` requires `repository_review` (provider `github`,
`repository`, `base_branch`, `allowed_reviewers`). `workflow-approve` then needs
`--pull-request` and an allowed login, and every local gate reports
`pending-trusted-verification`. Authentication happens only in the trusted
`pull_request_target` job, required for merging into the protected default
branch. That job is described in [Trusted repository review](trusted-review.md).
A workspace JSON file can never satisfy this mode, whatever it contains or
however it is signed.

## Failures and recovery

- **Rejected transition:** nonzero exit, nothing written.
- **Interrupted two-file mutation:** replacing two files is not one atomic step.
  A journal at `progress/work/.transition-journal.json` is written first, so a
  crash is detected. Every later mutation and `check.sh` fail until
  `workflow-rollback` restores the prior state; rerun the transition afterwards.
  Rollback refuses if either file changed since the crash.
- **Failed required hook** (`on_failure: error`): the state change stands, and
  a pending event blocks implementation, closure, and `workflow-check` until
  `workflow-recover` records a human decision. Hooks are never rerun
  automatically. A hook killed mid-run leaves the same pending event. Failures
  of `warn` hooks are recorded without blocking. Without a team policy the
  event is stored on the feature in `feature_list.json`, and recovery records a
  declared name (`declared-unmanaged-no-roles`).
- **Concurrent command:** it waits for the lock, then fails with a diagnostic.
  A file edited outside the tools between read and write makes the command fail
  without writing (`changed since it was read`).
- **Missing state:** an active `team_policy` with no `feature_list.json`, or a
  feature in `in_progress`/`done` without its record, fails `check.sh`.

## Known limits

The workspace is not a trust boundary: someone able to edit files can alter
records or remove `team_policy` together with them. That is visible in Git, not
prevented. Protect these paths through repository review. Work-record ownership
across clones is M4 scope.

Without `team_policy` (the shipped default and every fresh export), approval
digests, evidence, observed checks, and closing review are not enforced:
only transitions, spec artifacts, concurrency, finished tasks, and recorded
hook failures are. The output says so instead of implying stronger checks.
