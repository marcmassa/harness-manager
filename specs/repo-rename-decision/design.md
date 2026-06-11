# Design — Decide the repository rename and document as ADR-002

> Technical decisions to implement feature FEAT-022. Records the
> maintainer's decision as ADR-002 and (if the decision is to
> rename) executes the rename with a minimal, reviewable diff.
> The spec is deliberately **bifurcated** because the decision
> is irreversible and must be made by the maintainer, not the
> implementer.

## Summary

The project is named `harness-dashboard` everywhere except the
GitHub repository name itself, which is still `harness-manager`.
This is a documented inconsistency: the `package.json#name` is
`harness-dashboard-vscode`, the `displayName` is "Harness
Dashboard", the `vsce` Marketplace publisher publishes a VSIX
called `harness-dashboard-vscode`, the CHANGELOG entry for 0.1.0
announces "Renamed from *Harness Manager* to *Harness
Dashboard*", and the README badge URL still points to
`harness-manager` (a small but visible leftover).

The two viable paths forward are:

1. **Accept the mismatch and document it.** Add a note to
   `README.md` explaining why the repo is `harness-manager` and
   update only the cross-repo references (e.g., the CI badge)
   so the badge at least renders. The Marketplace listing,
   the npm package, and the install instructions are
   unaffected because they all use the
   `harness-dashboard-vscode` name already. Cost: zero
   disruption, but the inconsistency remains visible to
   evaluators who read the repo URL.
2. **Rename the GitHub repository to `harness-dashboard` and
   update all internal references.** GitHub's repo-rename
   feature auto-redirects the old URL, so existing
   `git clone` and `git fetch` calls keep working. The
   README badge URL, the CHANGELOG cross-links, the spec
   files that reference the repo URL — all need to be
   updated. Cost: ~30 minutes of careful sed/replace work
   + a manual GitHub Settings click; risk: a one-time window
   where the redirect may not be honoured by cached services
   (e.g., the Marketplace might take a few hours to re-index
   the new URL).

The spec presents both options as alternatives in ADR-002 and
lets the maintainer choose. The implementer is **explicitly NOT
authorised to make the decision** — it is a maintainer-level
choice with user-visible consequences.

## Affected Files (in both branches)

| File | Action (Accept branch) | Action (Rename branch) |
|---|---|---|
| `progress/decisions.md` | append ADR-002 | append ADR-002 |
| `progress/backlog.md` | remove the P0 item (R6) | remove the P0 item (R6) |
| `progress/impl_repo-rename-decision.md` | create with the ADR + rationale | create with the ADR + rename + checklist |
| `package.json#repository.url` | (no change) | update to `…/harness-dashboard` (R8) |
| `package.json#bugs.url` | (no change) | update to `…/harness-dashboard/issues` (R8) |
| `git remote origin` | (no change) | update to `…/harness-dashboard.git` (R9) |
| `README.md` | add a "Note on the repository name" section (R15) | update all GitHub URLs to `harness-dashboard` (R10); also add the note if the maintainer wants belt-and-suspenders |
| `specs/ci-github-actions/tasks.md` | (no change) | update the badge URL (R11) |
| Other `specs/**/*.md` with repo URLs | (no change) | update URLs (R11) |
| `LICENSE` | (no change) | (optional typo fix `Marc Massa` → `Marc Massa`; R13 cross-cut) |

**Not** modified (R13): any file under `src/`. The change is
exclusively metadata + docs.

## ADR-002 Content (skeleton the implementer fills in)

The implementer writes the ADR-002 with the maintainer's
chosen `Decision` field. The skeleton (which the implementer
uses as a starting point) is:

```markdown
### ADR-002: Decide the GitHub repository name
- **Status:** Accepted
- **Context:** (R3 — list the inconsistencies, see the
  Inventory section below for the full list)
- **Decision:** (R2 — "accept the mismatch and document it"
  OR "rename to `harness-dashboard` and update all references";
  chosen by the maintainer at the spec-approval gate)
- **Impact:**
  - **Positive:** (whichever the maintainer chose)
  - **Cost:** (R4 — must be honest, see the Cost Templates
    section below)
- **Discarded Alternatives:**
  - **Accept the mismatch** (R2-a): one paragraph on why this
    option was considered and why it was (or wasn't) chosen.
  - **Rename to `harness-dashboard`** (R2-b): one paragraph on
    why this option was considered and why it was (or wasn't)
    chosen.
```

### Context inventory (R3 — what the implementer must list)

When writing the ADR-002 `Context`, the implementer includes this
inventory (the items below were captured by `grep -rln` during
the spec-author phase, 2026-06-11):

| Where | What it says | The inconsistency |
|---|---|---|
| `package.json#name` | `harness-dashboard-vscode` | ✅ product name is right |
| `package.json#displayName` | `Harness Dashboard` | ✅ UI name is right |
| `package.json#publisher` | `marcmassacapo` | ⚠️ publisher is 12 chars but GitHub owner is `marcmassa` (9 chars); FEAT-backlog "Reconcile publisher identity" item exists |
| `package.json#repository.url` | `https://github.com/marcmassa/harness-manager` | ❌ points to old name |
| `package.json#bugs.url` | `…/harness-manager/issues` | ❌ points to old name |
| `git remote -v` | `github.com/marcmassa/harness-manager.git` | ❌ the actual remote |
| `CHANGELOG.md` (0.1.0 entry) | "Renamed from *Harness Manager* to *Harness Dashboard*" | ⚠️ announced but not completed |
| `README.md` (badge URL) | `github.com/marcmassa/harness-manager/actions/…` | ❌ stale URL in badge |
| `README.md` (install link) | `github.com/marcmassa/harness-manager` | ❌ stale URL in body |
| `README.md` (issues link) | `github.com/marcmassa/harness-manager` | ❌ stale URL in body |
| `specs/ci-github-actions/tasks.md` (badge URL in T13) | `github.com/marcmassa/harness-manager/actions/…` | ❌ stale URL in spec |
| Built VSIX | `harness-dashboard-vscode-0.1.2.vsix` | ✅ product artefact name is right |
| VS Code Marketplace listing | "Harness Dashboard" by `marcmassacapo` | ✅ Marketplace name is right |

The implementer copies this table verbatim into the ADR-002
`Context` field, with a one-paragraph narrative summary above it.

### Cost templates (R4)

The implementer chooses one of the two templates below, depending
on the maintainer's decision, and pastes it into ADR-002's
`Cost` sub-bullet (lightly adapted).

**If "accept the mismatch" is chosen**:

> The cost of this decision is small but permanent: a one-line
> note in `README.md` that explains the mismatch to future
> evaluators, and a one-paragraph explanation in this ADR.
> The mismatch itself does not cause runtime issues (the npm
> package, the VSIX, the Marketplace listing, and the
> install instructions all use `harness-dashboard` and are
> unaffected), but it remains a visible "smell" for anyone
> who clones the repo and reads the URL. The note is
> estimated to cost 5 minutes of writing and 0 minutes of
> code change.

**If "rename to `harness-dashboard`" is chosen**:

> The cost of this decision is the cost of the rename itself:
> (a) broken GitHub stars/forks redirect — although GitHub
> auto-redirects the old URL, any external link that has been
> cached (CDN, search engines, the VS Code Marketplace
> listing if it has indexed the old URL) will need to
> re-index; the redirect is immediate, but the cache TTL is
> not under our control, so a small window of 404s is
> possible; (b) the need to update the README badge and
> all spec files that reference the old URL, estimated at
> ~5-10 minutes of careful `sed` work; (c) a small but
> non-zero probability of the rename being unrecoverable if
> something goes wrong with the GitHub rename (e.g., a
> transient GitHub outage during the rename, or a tooling
> bug that re-creates the repo as a fork instead of
> preserving the history) — in the worst case the rename
> would need to be done manually by GitHub support, which
> takes 1-3 business days; (d) the `git remote` change is
> trivial (`git remote set-url origin …`) but every
> contributor's local clone needs the same change, so the
> rename should be announced in the project README and the
> CHANGELOG to remind contributors. Estimated total cost:
> 30 minutes of careful work, with a hard cap of one
> afternoon if something goes wrong.

## Algorithm / Flow

### Accept branch

```
1. Implementer reads the spec-approved `Decision` from the
   human's response to the pause.
2. Implementer writes ADR-002 with `Decision: "accept the
   mismatch"` and the `Cost` template above.
3. Implementer removes the P0 item from progress/backlog.md.
4. Implementer adds a "Note on the repository name" section
   to README.md (R15).
5. Implementer runs ./check.sh — must be green (R7).
6. Implementer commits as one commit:
   "docs: record ADR-002 — accept the harness-manager repo
    name and document the mismatch"
7. Done.
```

### Rename branch

```
1. Implementer reads the spec-approved `Decision` from the
   human's response to the pause.
2. Implementer writes ADR-002 with `Decision: "rename to
   harness-dashboard"` and the `Cost` template above.
3. Implementer removes the P0 item from progress/backlog.md.
4. Implementer updates package.json#repository.url and
   bugs.url (R8).
5. Implementer updates README.md (R10): all 3 GitHub URLs.
6. Implementer updates specs/ci-github-actions/tasks.md and
   any other specs/*.md with `harness-manager` in a URL (R11).
7. Implementer updates git remote (R9):
   `git remote set-url origin git@github.com:marcmassa/harness-dashboard.git`
   (the maintainer's actual GitHub-side rename will follow;
   see R12).
8. Implementer documents the GitHub-side manual steps in
   progress/impl_repo-rename-decision.md (R12).
9. Implementer runs ./check.sh — must be green (R7).
10. Implementer commits as one commit (R14):
    "refactor(repo): rename GitHub repository from
     harness-manager to harness-dashboard (R8-R11, R13)"
11. Maintainer performs the GitHub-side rename manually
    (Settings → General → Rename).
12. Done.
```

## Discarded Alternative

**Rename the GitHub repository without writing an ADR-002.**

Discarded because:

1. The rename is an **irreversible architectural decision**
   that affects every contributor, every external link, and
   the project's external perception. It must be documented
   in a way that future maintainers can find and understand
   ("why did we rename?"), and that documentation is exactly
   what an ADR is for. Skipping the ADR is the kind of
   thing that makes a project look unprofessional six
   months later when a new maintainer asks "wait, why is
   the repo named `harness-dashboard` when the package is
   `harness-dashboard-vscode`?" and there is no answer in
   the repo.

2. The framework this project is built on
   (Harness SDD, see ADR-001) explicitly mandates
   "document your decisions" for non-trivial changes. A
   repo rename is a non-trivial change.

3. Writing the ADR takes 10 minutes. Skipping it saves
   10 minutes and loses the institutional memory. The
   cost-benefit is clear.

## Risks and Edge Cases

- **GitHub redirect window** — the GitHub repo-rename
  feature auto-redirects the old URL, but cached services
  (search engines, CDNs, the VS Code Marketplace if it
  cached the old URL) may take hours to days to re-index.
  The README badge and the `git clone` URL will both
  resolve correctly during this window; the only visible
  effect is a brief "redirect" message in some links.
  Mitigation: announce the rename in the CHANGELOG and the
  README so users who encounter the redirect understand
  what is happening.

- **Local clones break** — every contributor's `git remote
  -v` will still show `harness-manager.git` after the
  rename. `git fetch` and `git pull` will work (GitHub
  auto-redirects), but `git push` may require the
  contributor to run `git remote set-url origin …`.
  Mitigation: the impl report includes the
  one-liner `git remote set-url origin …` so the maintainer
  can include it in the rename announcement.

- **The publisher mismatch (`marcmassacapo` vs
  `marcmassa`)** — this is a separate problem that is out
  of scope for FEAT-022 (it has its own backlog item:
  "Reconcile publisher identity"). If the maintainer wants
  to fix the publisher as part of the rename, that is a
  separate ADR-003. For FEAT-022, the publisher is
  mentioned in the `Context` section of ADR-002 (as a
  related-but-out-of-scope inconsistency) and is left for a
  later decision.

- **The LICENSE copyright "Marc Massa" typo** — out of
  scope for FEAT-022. The implementer MAY fix it as a
  side-effect of the rename (R13), but is not required to.

- **The CHANGELOG entry for 0.1.0 already says "Renamed
  from Harness Manager to Harness Dashboard"** — if the
  rename is chosen, this entry becomes true retroactively;
  if "accept the mismatch" is chosen, the entry should be
  amended to "intended to be renamed; the GitHub repo name
  was not updated due to [reason in ADR-002]". The spec
  does not require this amendment (the CHANGELOG is
  historical record), but the implementer MAY add a note.

## Test Plan

| Req | How verified |
|---|---|
| R1 | `grep -c '^### ADR-002' progress/decisions.md` returns 1; all 6 standard fields are present |
| R2 | The `Discarded Alternatives` section contains both "accept" and "rename" as separate bullets |
| R3 | The `Context` section contains the 13-row inventory table from this design |
| R4 | The `Cost` sub-bullet is non-empty and references the appropriate template |
| R5 | `grep -E 'ADR-001' progress/decisions.md` (in the new ADR-002 block) returns a match |
| R6 | `progress/backlog.md` no longer contains the P0 item about the rename |
| R7 | `./check.sh` exit 0 |
| R8 (rename only) | `python3 -c "import json; print(json.load(open('package.json'))['repository']['url'])"` returns `…/harness-dashboard` |
| R9 (rename only) | `git remote -v` shows the new URL |
| R10 (rename only) | `grep -nE 'harness-manager' README.md` returns no matches |
| R11 (rename only) | `grep -rnE 'harness-manager' specs/ --include='*.md'` returns no matches |
| R12 (rename only) | `progress/impl_repo-rename-decision.md` contains a "GitHub-side steps" section with the 5 items |
| R13 (rename only) | `git diff --name-only HEAD~1 -- src/` returns empty |
| R14 (rename only) | `git log --oneline HEAD~2..HEAD` shows at most 2 commits for this feature |
| R15 (accept only) | `README.md` contains a "Note on the repository name" section between "## License" and the end of file |
