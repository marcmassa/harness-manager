# Tasks — Decide the repository rename and document as ADR-002 (FEAT-022)

> Discrete steps in order. The implementer marks `[x]` upon
> completing each one. Each task references the R<n> it covers.
>
> The first half of the tasks (T1–T7) is **unconditional** — the
> ADR is always written. The second half (T8–T13) is
> **conditional** on the maintainer's decision in the ADR-002
> `Decision` field. The implementer only executes the
> conditional tasks if the spec-approved `Decision` is "rename
> to `harness-dashboard`".

## Pre-flight

- [ ] **T0** — Capture the spec-approved `Decision` from the
  maintainer's response to the spec-approval pause. The
  Decision is one of:
    - `accept` — "accept the mismatch and document it"
    - `rename` — "rename to `harness-dashboard` and update
      all references"
  The implementer SHALL NOT proceed with T1..T7 if the
  Decision is unclear; the maintainer must be asked.

## Unconditional: write the ADR + update the backlog

- [ ] **T1** — Append `### ADR-002: Decide the GitHub
  repository name` to `progress/decisions.md`, below
  ADR-001. Include all 6 standard fields. Use the skeleton
  from `design.md` as a starting point. Copy the 13-row
  inventory table into the `Context` field verbatim. Set
  the `Decision` field to the maintainer's choice. Use the
  appropriate `Cost` template. List both alternatives in
  `Discarded Alternatives` (one is the chosen, one is
  discarded). Reference ADR-001 in `Context` or `Impact`.
  _(R1, R2, R3, R4, R5)_
- [ ] **T2** — Remove the P0 item from `progress/backlog.md`
  (the `Decide: rename the repository…` bullet). The item is
  shipped; the backlog shall not reference it. _(R6)_
- [ ] **T3** — Run `./check.sh` and confirm exit 0 with 33
  passes, 0 fails. The governance guard's R9 cross-grep
  should not fire because the backlog item was removed in
  T2. If it does fire, fix the cross-grep in the same
  commit. _(R7)_

## Conditional: ONLY if the Decision is "rename"

- [ ] **T4** — Update `package.json#repository.url` to
  `https://github.com/marcmassa/harness-dashboard` and
  `package.json#bugs.url` to
  `https://github.com/marcmassa/harness-dashboard/issues`.
  Verify with `python3 -c "import json; …"`. _(R8)_
- [ ] **T5** — Update `git remote -v` to point to the new
  URL: `git remote set-url origin
  git@github.com:marcmassa/harness-dashboard.git`. Verify
  with `git remote -v`. _(R9)_
- [ ] **T6** — Update all 3 GitHub URLs in `README.md` to
  point to `harness-dashboard`:
    - the CI badge URL (line 5),
    - the "Open a workspace that uses [Harness SDD]" link
      (line 58),
    - the "Issues and PRs welcome at" link (line 81).
  Verify with `grep -nE 'harness-manager' README.md`
  (should return no matches). _(R10)_
- [ ] **T7** — Update the CI badge URL in
  `specs/ci-github-actions/tasks.md` (line 27) to point to
  `harness-dashboard`. Verify with
  `grep -rnE 'harness-manager' specs/ --include='*.md'`
  (should return no matches). Also check the other spec
  files that contain `harness-manager` (webview-foundation,
  skill-toggle-and-suggestion-control) and update their
  `harness-manager` references if they are URLs. If they
  are prose (e.g., "The repo was originally called
  `harness-manager`"), leave them alone — those are
  historical references, not live URLs. _(R11)_

## Conditional: ALWAYS (both branches)

- [ ] **T8** — Create `progress/impl_repo-rename-decision.md`
  with:
    - a one-paragraph summary of the Decision,
    - the R↔T↔test map (which tasks satisfied which R),
    - the verification commands and their outcomes (T3, plus
      T4–T7 if the rename branch),
    - a "GitHub-side steps" section (always, for both
      branches) explaining what the maintainer must do
      manually on GitHub (Settings → General → Rename,
      confirm the redirect, verify the badge, verify the
      Marketplace listing). For the "accept" branch, the
      section is "no GitHub-side action required". For the
      "rename" branch, the section is the 5-step checklist
      from design.md. _(R12 conditional, or R15 conditional
      for the accept branch)_
- [ ] **T9** — Run `./check.sh` one final time and confirm
  exit 0. _(R7)_
- [ ] **T10** — Verify no production source code was
  modified: `git diff --name-only HEAD~1 -- src/`
  (rename branch) or `git diff --cached --name-only -- src/`
  (accept branch) should return empty. _(R13)_
- [ ] **T11** — If the Decision is "accept" (R15 branch),
  add a "Note on the repository name" section to
  `README.md`, immediately after the `## License`
  section. The note is 1-3 sentences explaining that the
  repo is intentionally named `harness-manager` and the
  mismatch is documented in ADR-002. _(R15)_
- [ ] **T12** — Update `feature_list.json`: set FEAT-022
  `status` to `"done"`.
- [ ] **T13** — Append a summary to `progress/progress.md`
  following the format of prior entries (FEAT-001 through
  FEAT-021).
- [ ] **T14** — If the Decision is "rename", commit as ONE
  commit with a conventional-commits message
  (`docs(repo): record ADR-002 and rename repository
  references (R1–R11)`). If the Decision is "accept",
  commit as ONE commit
  (`docs: record ADR-002 — accept the harness-manager repo
  name`). _(R14)_

## Conditional: the maintainer's manual step (rename only)

- [ ] **T15** — After the commit lands, the maintainer
  performs the GitHub-side rename:
    1. Open the repository's **Settings** tab.
    2. Under **General**, find the **Repository name**
       field and change it to `harness-dashboard`.
    3. Click **Rename**.
    4. Verify the redirect by visiting the old URL in a
       browser (should auto-redirect to the new URL).
    5. Wait ~1 hour for the GitHub redirect to propagate,
       then verify the README badge in the README.md
       renders green.
  This step is NOT automated; it is the maintainer's
  responsibility. The impl report's "GitHub-side steps"
  section documents the procedure so the maintainer has
  the checklist. _(R12 follow-through)_
