# Trusted repository review (GitHub)

`review_mode: "repository"` replaces a declared local reviewer with a GitHub
pull-request review that a trusted CI job verifies. Local commands never
produce `provider-verified`. Only `.agents/lib/trusted_verify.py`, running in
`.github/workflows/trusted-review.yml`, can produce it, and only that job's
result on the pull request decides the merge when an active ruleset requires
this workflow by source identity.

This page describes the configuration as written. Nothing here claims that a
real deployment, provider call, or required check has been exercised. That
remains external evidence for the maintainer to record.

## Trust boundary

| Element | Source | Trusted? |
|---|---|---|
| Workflow definition | Default branch (`pull_request_target` runs the default-branch file) | Yes |
| Verifier code and team policy | Checkout of `github.sha`, the default-branch commit | Yes |
| Pull request number, head | Runner event payload, used only to select what to fetch | Selector only |
| Pull request state, base, head, author | `GET /repos/{owner}/{repo}/pulls/{number}` | Provider data |
| Reviews | `GET /repos/{owner}/{repo}/pulls/{number}/reviews`, all pages | Provider data |
| Candidate files | `refs/pull/{number}/head` fetched as Git objects, read with `cat-file` | Data, never executed |

The job never checks out, builds, imports, or runs pull-request content. The
token has `contents: read` and `pull-requests: read` only. It is passed to
the API client as an unredirected header and to `git fetch` through
environment configuration, and it is never printed. The API origin is the
constant `https://api.github.com`, and redirects are refused. Nothing accepts
a caller-chosen endpoint, key, policy, result file, or workspace JSON.

## What the verifier checks

It fails closed (exit 1) on any provider, token, or transport error, and on
missing trusted context (exit 2): not GitHub Actions, not `pull_request_target`,
no token, an event file inside the workspace, a checkout that is not the clean
`GITHUB_SHA`, a ref that is not the policy `base_branch`, or a `base_branch`
that is not the default branch.

1. The repository is the policy `repository_review.repository`. The pull request
   is open, not merged, and targets `base_branch`. Its head is a full SHA and
   equals both the event head and the fetched commit; a moved head is rejected
   as stale.
2. Reviews are read across all pages. The latest decisive state per login
   (approved, changes requested, dismissed) wins. Comments do not change it,
   and deleted accounts never count.
3. Code review: an `allowed_reviewers` login, a `User` account and not the
   pull-request author, must currently approve exactly the head commit. Any
   allowed reviewer whose latest state is changes requested blocks.
4. For each feature whose spec, work record, or `feature_list.json` entry the
   pull request changes, at `in_progress` or `done`:
   - the candidate record has a repository-mode approval naming
     `pull_request` and `reviewer`;
   - the spec digest and the task-structure digest, computed from the
     candidate's blobs, match the approval (a scope-change record covers task
     edits);
   - the named reviewer currently approves a commit on that pull request whose
     own blobs hash to the same digest. An earlier spec pull request may
     supply this, as the design allows for newer implementation revisions.
5. For `done`, the record's closure revision is an ancestor of the head and
   differs from it only in `progress/` and `feature_list.json`. Tasks are
   complete, evidence resolves to test symbols in that revision's blobs, and a
   passing `check.sh` entry exists for it.

Passing yields `provider-verified`, bound to the head SHA, in the job log and
step summary. With `review_mode: "local"` on the default branch, the job reports
`not-required` and succeeds.

## Deploying it (maintainer)

1. Policy on the default branch: set `review_mode` to `"repository"` and add
   `repository_review` with `provider: "github"`, `repository: "owner/name"`,
   `base_branch` (the default branch), and `allowed_reviewers` (GitHub logins).
   The roles in `authority` remain local, declared labels.
2. Deploy `.github/workflows/trusted-review.yml` to the default branch.
   The checkout action is pinned to a commit. Protect the workflow, verifier,
   and policy paths through CODEOWNERS and require their owners' reviews.
3. Create an active organization or enterprise ruleset targeting the default
   branch. Select **Require workflows to pass before merging**, then select the
   trusted source repository, protected ref, and `trusted-review.yml` workflow.
   Require a pull request, dismiss stale approvals, require approval from someone
   other than the last pusher, require the regular CI matrix checks, and configure
   the rule without bypass. Confirm on a disposable PR that a missing or failing
   trusted workflow blocks merging, even when another job uses the same name.
   This deployment needs access to organization or enterprise required workflows.
   Keep local review mode for repositories without that rule.

   See [supported ruleset workflow events](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#supported-ruleset-workflow-events)
   and [workflow rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-workflows-to-pass-before-merging).

4. After a reviewer approves, re-run the trusted check. `pull_request_target`
   does not trigger on review submission, and reviews submitted through
   `pull_request_review` would run pull-request workflow code instead.
5. Record repository approvals locally with
   `workflow-approve --reviewer <login> --pull-request <n>`. They stay
   `pending-trusted-verification` until the job verifies them.

## How closure consumes the result

In repository mode, closure is a pull request that carries the `done`
transition (status, evidence, observed checks, closing review). Locally,
`workflow-transition --target done` runs every local gate. The result is
labeled `pending-trusted-verification`, and `workflow-check` repeats that
label for each such record. The closure takes effect only when that pull
request merges into the protected default branch, where the required workflow must verify the head. The local label
continues to describe a pending result. Deployment validation must exercise
the ruleset against a failed and a successful candidate.

## Limits

- GitHub accepts `pull_request_target` as a status check event. A status check
  selected by job name and the GitHub Actions app does not bind it to this
  workflow. The required workflow ruleset provides that source binding.
- This verifier handles pull requests targeting the default branch. Deploy it
  without a merge queue until a separate `merge_group` verifier is available.
- Local state can still contain a proposed `done` transition with a pending
  provider result. The protected merge is the current enforcement point.
  A direct authenticated completion gate in the local command remains open
  for review against R15.
- The `check.sh` result in a record is a local observation. The unprivileged
  `validate` matrix in `ci.yml` reruns it in CI.
- Only GitHub is supported. Other hosts use local mode, which is explicitly
  weaker.
