# Decisions

Technical decisions log (lightweight ADR style).

## Format

Each entry is an Architecture Decision Record (ADR). The format is
deliberately lightweight — one markdown section per decision, six
standard fields, no external tooling required. The first ADR below
(ADR-001) is a complete worked example; subsequent ADRs follow the
same shape.

The six standard fields, in order, are:

- **Status** — one of `Accepted`, `Proposed`, `Rejected`, or
  `Superseded by ADR-N` (where `N` is the new ADR's number).
- **Context** — the situation that forced the decision. What was
  the trigger? What constraints applied?
- **Decision** — what was decided, in one or two sentences. State
  the rule, not the rationale (rationale lives in `Context` and
  `Impact`).
- **Impact** — broken into two sub-bullets:
  - **Positive** — expected benefits.
  - **Cost** — trade-offs, overhead, or risks the decision imposes.
- **Discarded Alternatives** — at least two alternative approaches
  that were considered and rejected, each with a one-sentence reason.

ADRs are append-only: new entries go below the previous ones (the
file is read top-to-bottom in chronological order). If a decision
is reversed, the original ADR is **not deleted**; its `Status` is
changed to `Superseded by ADR-N` and a pointer to the new ADR is
added. This preserves the audit trail of *why the old decision was
made at the time* even after it is reversed.

---

*[Decisions are added below, in chronological order]*

### ADR-001: Adopt the Harness SDD framework for the Harness Dashboard repository
- **Status:** Accepted
- **Context:** The Harness Dashboard project started as a fork of the
  Harness SDD template in June 2026. The first 17 features were shipped
  using the framework's Spec Driven Development (SDD) workflow: EARS
  requirements, a design document with discarded alternatives, a
  tasks checklist with R↔T↔test traceability, a human approval gate
  at `spec_ready`, and a `done` flip blocked on `./check.sh` going
  green. The project now needs a documented record of *why* this
  workflow is the canonical way of working here, so that future
  contributors (human and AI) understand that going outside it is an
  explicit decision, not a default — and so that the framework's
  credibility as a showcase is anchored in a real, dated, traceable
  commitment.
- **Decision:** All non-trivial changes to the Harness Dashboard
  project SHALL go through the Harness SDD workflow: a `pending`
  feature in `feature_list.json` is shaped into a `specs/<name>/`
  folder with `requirements.md` (EARS), `design.md` (with discarded
  alternatives), and `tasks.md` (with R↔T↔test map) by the
  `spec-author-vscode` sub-agent. The spec waits at `status: spec_ready`
  for human approval. The `typescript-implementer` sub-agent then
  executes the tasks. The `reviewer-vscode` sub-agent verifies
  R↔T↔test traceability before flipping the feature to `done`.
  `./check.sh` is the canonical local gate (one feature in
  `in_progress` at a time, all `sdd: true` features at `spec_ready`
  or beyond have all three spec files present, generated CLI adapters
  are in sync with `agentic.json`, the new "Governance Documents"
  check finds no leftover template placeholders, etc.). The
  GitHub Actions workflow (`.github/workflows/ci.yml`) re-runs the
  same gate on every push and pull_request to `main`, so the local
  gate and the CI gate are *the same gate*.
  Trivial changes (typos in comments, dependency-version bumps
  driven by `npm audit`, README formatting) MAY be committed
  directly without a spec, at the maintainer's discretion; this
  exemption is logged in the commit message.
- **Impact:**
  - **Positive:** every shipped feature has a documented rationale
    (the EARS requirements), an explicit design with discarded
    alternatives (no "we tried X" is forgotten), and at least one
    test for every R<n> (R↔T↔test traceability, asserted in
    `progress/impl_<feature>.md`). Bugs caught at the spec phase
    are roughly an order of magnitude cheaper to fix than bugs
    caught after merge. The state machine
    `pending → spec_ready → in_progress → done` is visible in
    `feature_list.json` and enforced by `check.sh`, so a maintainer
    landing at the project cold can answer "what is in flight?"
    with a single command (`./check.sh`). The framework is
    dogfooded: the same SDD workflow that the extension helps
    visualise is what the maintainers use to ship the extension,
    which is the strongest possible demonstration of the
    framework's viability.
  - **Cost:** every non-trivial feature requires three spec files
    (`requirements.md`, `design.md`, `tasks.md`) to be written and
    approved before any code is touched. A small feature (one
    component, ~50 LOC) costs roughly 30 minutes of `spec-author`
    time and 5 minutes of human review. The `spec-author-vscode`
    and `typescript-implementer` sub-agents must reload the same
    context files (`AGENTS.md`, `feature_list.json`,
    `progress/current.md`, the approved `specs/<feature>/`) at the
    start of every session, which adds a fixed ~10 KB of context
    overhead per invocation. The 17-feature MVP took roughly three
    calendar weeks end-to-end at the cost of this overhead; a
    estimate (not measured) is that a no-SDD process would have
    finished the same MVP in one to two weeks but with a
    post-merge bug rate several times higher, because there would
    be no spec phase to catch the "I assumed the user wanted X
    but they actually wanted Y" class of mistake.
- **Discarded Alternatives:**
  - **Standalone ADRs in `docs/adr/NNNN-*.md` using the MADR
    template**: MADR (Markdown Any Decision Record) is the
    community standard for decision records, with a 4-section
    structure similar to this ADR's. Discarded because it lives
    *outside* the SDD workflow and would create a parallel
    documentation system: the project would have one set of
    "decisions" in `docs/adr/` and another set of "discarded
    alternatives" inside each `specs/<feature>/design.md`. The
    project already has `progress/decisions.md` for ADRs and the
    SDD design doc already mandates a "Discarded Alternatives"
    section per feature, so the MADR layer would be redundant
    without adding signal.
  - **arc42 template for `DESIGN.md`**: arc42 is comprehensive
    (12 sections, ISO-aligned, designed for very large systems).
    Discarded because it is overkill for a single VS Code
    extension (the project's `DESIGN.md` is 49 lines; an
    arc42-compliant design doc would balloon to 200+ lines and
    would conflict with the 6-section `DESIGN.md` template that
    the Harness SDD framework itself ships). The framework's
    6-section template is sufficient for this project's scale
    and aligns with the framework's "design as a 30,000-foot
    view, deep-dives in `docs/architecture/<topic>.md`" guidance.
  - **No formal ADR process**: rejected because the project is a
    framework showcase. Shipping a framework that preaches
    "document your decisions" while having no ADRs of its own
    would undermine the framework's credibility with evaluators.
    The cost of the lightweight ADR format (one entry per
    architecturally significant decision, ~50 lines each) is
    small compared to the credibility benefit.

---

### ADR-002: Accept the GitHub repository name `harness-manager` and document the mismatch
- **Status:** Accepted
- **Context:** The Harness Dashboard project started as a fork
  of the Harness SDD template in early June 2026. The first
  feature (FEAT-001) shipped under the name `Harness Manager`,
  but the project's first user-visible release (v0.1.0, dated
  2026-06-08) was renamed to `Harness Dashboard` — the
  `CHANGELOG.md` entry for 0.1.0 records the rename
  explicitly: "Renamed from *Harness Manager* to *Harness
  Dashboard* (identifier prefix: `harness-dashboard`)".

  In practice, the rename was applied to **almost everything**
  except the GitHub repository name itself. The current state
  of the project is:

  | Where | What it says | Status |
  |---|---|---|
  | `package.json#name` | `harness-dashboard-vscode` | ✅ product name is right |
  | `package.json#displayName` | `Harness Dashboard` | ✅ UI name is right |
  | `package.json#publisher` | `marcmassacapo` | ⚠️ publisher is 12 chars but GitHub owner is `marcmassa` (9 chars). **Out of scope for this ADR** — see "Related but out of scope" below. |
  | `package.json#repository.url` | `https://github.com/marcmassa/harness-manager` | ❌ points to old name |
  | `package.json#bugs.url` | `…/harness-manager/issues` | ❌ points to old name |
  | `git remote -v` | `github.com/marcmassa/harness-manager.git` | ❌ the actual remote |
  | `CHANGELOG.md` (0.1.0 entry) | "Renamed from *Harness Manager* to *Harness Dashboard*" | ⚠️ announced but not completed |
  | `README.md` (badge URL) | `github.com/marcmassa/harness-manager/actions/…` | ❌ stale URL in badge |
  | `README.md` (install link) | `github.com/marcmassa/harness-manager` | ❌ stale URL in body |
  | `README.md` (issues link) | `github.com/marcmassa/harness-manager` | ❌ stale URL in body |
  | `specs/ci-github-actions/tasks.md` (T13 badge URL) | `github.com/marcmassa/harness-manager/actions/…` | ❌ stale URL in spec |
  | Built VSIX artefact | `harness-dashboard-vscode-0.1.2.vsix` | ✅ product artefact name is right |
  | VS Code Marketplace listing | "Harness Dashboard" by `marcmassacapo` | ✅ Marketplace name is right |

  The audiences affected are: (a) **GitHub visitors** who
  clone or star the repo and see the URL `harness-manager`;
  (b) **VS Code Marketplace users** who install "Harness
  Dashboard" and never see the `harness-manager` name; (c)
  **contributors** who clone the repo and run
  `git remote -v`; (d) **CI consumers** who follow the
  `https://github.com/marcmassa/harness-manager` URL in the
  README badge.

  This is the last P0 item in the backlog written by FEAT-019
  ("Decide: rename the repository or accept the mismatch"),
  and the maintainer has now decided which path to take (see
  `Decision` below).

- **Decision:** **Accept the mismatch and document it.**
  The repository's GitHub name stays as `harness-manager` for
  historical and operational reasons (the rename was deferred
  at the v0.1.0 release; reversing it now would require a
  manual GitHub Settings action with a small but non-zero
  window of broken redirects). The mismatch is documented in
  this ADR and in a short "Note on the repository name"
  section appended to `README.md` (per R15 of
  `specs/repo-rename-decision/requirements.md`).

  Going forward, **all new internal references** (spec files,
  new docs, new commit messages) SHALL use `harness-dashboard`
  (the product name) when referring to the project as a
  whole, and `harness-manager` (the repo URL) only when a
  literal URL is required (e.g., the README badge, the
  `package.json#repository.url` field). The two names refer
  to the same project; the mismatch is a historical accident
  that the project has decided is not worth the cost of
  fixing.

- **Impact:**
  - **Positive:** the maintainer saves ~30 minutes of careful
    rename work; the project's GitHub history, stars, forks,
    and any external links to the old URL keep working
    exactly as they have been (the redirect is not needed
    because the URL has not changed); the existing CI
    workflow (FEAT-018) does not need to be re-pointed; the
    VS Code Marketplace listing is unaffected (it uses the
    `harness-dashboard-vscode` package name and the
    `marcmassacapo` publisher, both of which are correct);
    the maintainer can do a rename later if/when the
    operational risk is lower (e.g., when a v0.2.0 release
    with a clean Marketplace listing justifies the
    transition). The mismatch is now documented in a way
    that future maintainers and evaluators can find, so the
    "smell" is acknowledged rather than ignored.
  - **Cost:** the cost of this decision is small but
    permanent. A one-section note in `README.md` (R15 of the
    spec) explains the mismatch to future evaluators; this
    ADR-002 itself is ~80 lines of documentation. The
    mismatch itself does not cause runtime issues (the npm
    package, the VSIX, the Marketplace listing, and the
    install instructions all use `harness-dashboard` and are
    unaffected), but it remains a visible inconsistency for
    anyone who clones the repo and reads the URL. Estimated
    total cost: 15 minutes of writing time, 0 minutes of code
    change, 0 minutes of CI reconfiguration. The "smell" is
    now reduced from "undocumented inconsistency" to
    "documented intentional inconsistency", which is a
    strictly better state.

- **Discarded Alternatives:**
  - **Rename the GitHub repository to `harness-dashboard` and
    update all internal references.** This was the
    alternative the maintainer could have chosen, and is
    rejected for this decision window for the following
    reasons: (1) the rename is irreversible from the
    maintainer's side (GitHub keeps the old name available
    as a redirect, but the new name is the canonical one
    forever after); (2) the rename requires a manual
    GitHub Settings action that the maintainer did not want
    to perform in this session; (3) the rename would
    require updating 5+ files (`package.json`, `README.md`,
    `specs/ci-github-actions/tasks.md`, other spec files,
    `git remote`) with careful attention to URL syntax; (4)
    there is a small but non-zero window of broken
    redirects immediately after the rename (the GitHub
    redirect is immediate, but cached services may take
    hours to days to re-index). Total estimated cost if
    chosen: 30 minutes of careful work, with a hard cap of
    one afternoon if something goes wrong. This option is
    explicitly **not discarded permanently** — it is the
    natural next step if/when the project reaches a milestone
    (e.g., v0.2.0 or v1.0.0) that justifies the operational
    cost. The "accept" decision is a deferral, not a
    permanent veto.
  - **Rename the package and the VSIX to `harness-manager`
    to make everything consistent.** This is the opposite
    direction and is rejected because: (1) it would
    require renaming 18+ files and references (everywhere
    `harness-dashboard` appears, including `package.json`,
    the VSIX, the display name, the README, the
    Marketplace listing, the CHANGELOG); (2) it would
    require a new Marketplace publisher (or the same
    `marcmassacapo` publisher pointing at a different name);
    (3) it would confuse users who already know the project
    as "Harness Dashboard"; (4) the cost of a 17-feature
    rebranding is strictly higher than the cost of the
    status quo. Discarded.

- **Related but out of scope (tracked separately):**
  - **Publisher identity**: `package.json#publisher` is
    `marcmassacapo` (12 chars) but the GitHub owner is
    `marcmassa` (9 chars). This is a separate inconsistency
    that affects Marketplace publishing (the Marketplace
    may reject a publish if the publisher name does not
    match the GitHub owner exactly). This is tracked in
    the backlog as "Reconcile publisher identity" and will
    be addressed in a future feature. ADR-002 does NOT
    include the publisher in the `Decision` because the
    publisher and the repo URL are two separate decisions
    (a publisher can be renamed without renaming the repo,
    and vice versa), and combining them would make this ADR
    harder to reason about. When the publisher is
    addressed, that work will produce ADR-003.

- **Cross-references:** This ADR follows the ADR-001 pattern
  established in FEAT-019 ("Adopt the Harness SDD framework
  for the Harness Dashboard repository"). The decision to
  use the SDD workflow (ADR-001) and the decision to
  document the repo name (ADR-002) are independent but
  complementary: ADR-001 mandates that we document
  non-trivial decisions, and ADR-002 is one such decision.
  A future contributor who finds ADR-001 will also find
  ADR-002, and vice versa, because they are in the same
  file (`progress/decisions.md`).

---

### ADR-003: Keep `WindsurfAdapter` in the codebase but stop advertising Windsurf as a supported framework
- **Status:** Accepted
- **Context:** When FEAT-015 ("Universal Agent Architecture Reader")
  was implemented in early June 2026, the project shipped seven
  adapters: `HarnessSddAdapter`, `ClaudeCodeAdapter`,
  `GeminiCliAdapter`, `CursorAdapter`, `CopilotAdapter`,
  `OpenCodeAdapter`, and `WindsurfAdapter`. All seven were
  registered in `src/adapters/index.ts` and exercised by
  `src/adapters/adapterRegistry.test.ts`.

  On 2026-06-11 (during the 0.2.0 release prep), the Windsurf
  product was **discontinued** by its publisher. The
  `WindsurfAdapter` still parses `.windsurf/rules/`
  workspaces correctly, but:
  1. No new user can realistically adopt Windsurf.
  2. The README's "Supported project structures" table is
     user-facing advertising; listing a discontinued
     product is misleading.
  3. The Marketplace listing for the extension would appear
     to "support" a non-existent product, which is a
     credibility smell.

  This ADR documents the decision: **keep the adapter in
  the codebase, but stop advertising it as supported**.

- **Decision:** The `WindsurfAdapter.ts` source file,
  its entry in `src/adapters/index.ts`, and its coverage
  in `src/adapters/adapterRegistry.test.ts` are all
  retained **unchanged** (the adapter is correct code and
  the unit tests still pass). What changes:
  - `README.md`: the "Supported project structures" table
    no longer lists Windsurf, and a callout at the bottom
    of the table explains that the adapter source still
    ships for users with existing Windsurf workspaces.
  - `DESIGN.md`: the high-level description no longer
    names Windsurf; the component table and the data-flow
    diagram annotate the adapter as `[DEPRECATED, see
    ADR-003]`.
  - The CHANGELOG entry for 0.2.0 records the change.

  Going forward, the WindsurfAdapter is treated as a
  **legacy adapter**: it ships, it works, it is tested,
  but it is not advertised. A future major release
  (e.g., v1.0.0) MAY remove it; until then, removing it
  would be a breaking change for any user with an
  existing Windsurf workspace.

- **Impact:**
  - **Positive:** the README, the Marketplace listing,
    and the user-facing product surface no longer
    advertise a discontinued product; new evaluators
    do not get a "this is dead" signal when they see
    Windsurf in the table. The codebase stays compatible
    with users who have an existing Windsurf workspace
    (no breaking change). The adapter and its test
    coverage are preserved, so removing the adapter
    entirely in a future release is a one-line change
    (`delete WindsurfAdapter.ts` and the two
    `index.ts` / `test.ts` references).
  - **Cost:** the codebase still contains ~110 lines of
    `WindsurfAdapter` code that no new user will exercise.
    This is a small ongoing maintenance cost (one more
    file to keep in sync if the `IAgentAdapter` interface
    changes), but it is bounded and well-understood.
    The cost of *removing* the adapter is higher because
    it would break any user with an existing Windsurf
    workspace, and we do not have telemetry to know how
    many such users exist.

- **Discarded Alternatives:**
  - **Remove `WindsurfAdapter` entirely.** Discarded
    because: (a) it is a breaking change for any existing
    user with a Windsurf workspace, and we do not have
    data on how many such users exist; (b) the adapter
    is small (~110 lines) and well-tested, so the
    "dead code" cost is low; (c) keeping the adapter
    preserves a graceful deprecation path: the adapter
    can be removed in v1.0.0 with a major-version bump
    and a CHANGELOG note, rather than silently breaking
    in a minor version.
  - **Keep the adapter and continue to advertise it as
    supported.** Discarded because: (a) it is
    misleading to new users (they will discover the
    product is discontinued when they try to install
    it); (b) it is a credibility smell for evaluators
    who do their homework; (c) the cost of the
    "advertise as supported" framing is higher than
    the cost of the "legacy, not advertised" framing.

- **Related decisions:**
  - ADR-001 (Harness SDD framework adoption) — the
    SDD process this ADR was written under.
  - ADR-002 (Accept the GitHub repository name
    `harness-manager`) — the previous ADR; this is
    the third in the series.
  - FEAT-021 (Validate each of the 7 universal
    adapters against a real-world repo of its
    framework) — the future-feature backlog item
    that this decision affects. With Windsurf
    removed from the "supported" list, FEAT-021
    effectively becomes "validate 6 universal
    adapters" (the 7th, Windsurf, is implicitly
    validated by existing unit tests only). The
    backlog item is updated accordingly when FEAT-021
    is created.

---

