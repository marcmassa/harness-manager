# FEAT-042 implementation evidence

## T1 — Evidence through deduplication, rule classification, shared maturity

Layer-2 deduplication still removes adapter-claimed files, so the graph has no duplicate nodes. Their meaning now survives as `AgenticProfile.evidence`: one item per provider resource, built by `evidenceFromGraph` in `src/agentic-detector/evidence.ts`. The item maps the declared type to a shared category:

| Declared type | Category |
|---|---|
| instructions | `context-identity` |
| roles | `agent-methodologies` |
| skills | `skills` |
| steering | `rules` |

`sharedCategories` reads `.agents/**` signals by meaning:
- an unclaimed `.agents/steering/x.md` counts as a rule file;
- `agentic.json` itself counts as nothing, because its resources arrive as Harness SDD evidence.

Rules and maturity both read this one function.

Maturity changes:
- The `hasHarness` shortcut to L2/L3 is removed.
- L5 needs a governed lifecycle: a feature registry or spec documents in any layout (`.kiro/specs/*/requirements.md`, `specs/*/requirements.md`, `feature_list.json`). A Harness SDD manifest alone no longer counts.
- Next-level hints name no framework.
- `MaturityInfo.unavailableInputs` lists the inputs that could not be assessed, and says that agent CLIs are detected from configuration rather than verified.

Advisory rules are split by family into `advisoryRules.ts` (S01–S12) and `methodologyRules.ts` (S13+), with evidence-based helpers in `ruleHelpers.ts`. `ruleScopes.ts` classifies every rule as shared, provider-specific (`harness-without-sdd` → Harness SDD, `add-claude-md` → Claude Code) or optional (supply chain), and records the inputs each rule needs. Corrected rules:
- `add-claude-md` is suppressed when Claude Code already supplies instructions.
- `cli-without-impl` counts instructions, roles and skills as implementation.
- `migrate-to-steering` fires only for single-tool rule formats.
- `adopt-sdd` and `ready-for-sdd` describe a governed lifecycle in any layout.

| Requirement | Verification |
|---|---|
| R1 | byohAdvisory.test.ts: provider resources map to categories; a real `CLAUDE.md` plus a Claude agent yields Claude Code evidence and never `add-claude-md`, `add-context-identity` or `cli-without-impl`. |
| R2 | byohAdvisory.test.ts: every rule is classified and provider rules name a known provider. Display of scope and evidence on findings is T2. |
| R3 | maturityClassifier.test.ts: equivalent Harness SDD and Claude Code evidence give the same level and inputs, and a manifest signal alone gives L0. byohAdvisory.test.ts: equivalent native workspaces scanned end to end share categories, level and unavailable inputs. agenticDetector.test.ts: a manifest alone is not a lifecycle, and spec documents are. |
| R4 | maturityClassifier.test.ts and byohAdvisory.test.ts: unavailable inputs are named, including for an unknown root. |

To stay under the 20,000-byte staged-file limit:
- `advisoryEngine.ts` is split as described above.
- `agenticDetector.test.ts` is split into a scan suite and a lifecycle suite, sharing the `vscode` mock in `detectorTestHarness.ts`.
- `advisoryEngine.test.ts` is split into level and behaviour suites.

Verified: 870 unit tests.

## T2 — Source-scoped findings

`generate()` turns each matching rule into owner-qualified instances (`advisoryEngine.ts`):
- A workspace-wide finding keeps the rule ID.
- A provider's finding is `<ruleId>@<providerId>`.
- A rule classified `perOwner` (today `migrate-to-steering`) yields one finding per owning provider, plus a workspace one for unclaimed files.

Every suggestion carries `ruleId`, `scope`, `evidence` (up to five attributed sources in its category) and `reason` (the inputs the rule evaluated).

A dismissal stored under a bare rule ID before FEAT-042 still hides a finding with a single instance. It never hides one owner's finding when two owners share the rule. Dismissals keep living in the workspace state, so they are per workspace.

The Advisory panel names the provider (or "Workspace-wide"), the supporting files and "Based on: …" under each suggestion title, and lists the maturity inputs that were not assessed.

`AdvisoryPanel.tsx` (40 KB) was split verbatim to stay under the staged-file limit: `advisoryParts.tsx`, `SuggestionCard.tsx`, `SupplyChainSection.tsx`, `AdvisorySections.tsx`. Its pre-existing type diagnostics are unchanged.

| Requirement | Verification |
|---|---|
| R2 | byohAdvisory.test.ts: two providers with the same rule get their own ID, scope, evidence and reason; a finding without evidence is workspace-wide. AdvisoryFindings.test.ts renders both cases. |
| R4 | AdvisoryFindings.test.ts: the "Not assessed" list renders the unavailable inputs. |
| R7 | byohAdvisory.test.ts: a legacy dismissal applies only when unambiguous; dismissing one owner leaves the other actionable; a removed source drops its finding; an owner-qualified dismissal survives two rescans. |

Verified: 878 unit tests, build.

## T3 — Advisory actions and legacy scaffolds through the owner decision

`requestForAction` (src/operations/operations.ts) maps each resolved Advisory action to the decision it needs:

| Action | Decision |
|---|---|
| `open-file` | a read; no decision |
| `create-file`, `create-directory` | adoption; refused when the file is the entry point of a provider that is already present (`CLAUDE.md`, `GEMINI.md`, `.agents/**`) |
| `scaffold-agent`, `scaffold-skill` | they write `.agents/**`, so they need a provider that creates entities (Harness SDD); in a workspace with no harness they are an explicit adoption; inside another provider's harness they are refused |
| `run-command` | the new `workspace.command` operation, which needs trust |

The same adoption rule now covers architecture templates, which write through the Harness SDD writer.

Two places apply these rules:
- `AdvisoryCoordinator` resolves the action from the current host profile, as before, then asks the gate before executing.
- `generate()` stops offering actions the present harness does not support (R5), so a Claude-only workspace no longer shows "Create my-first-skill" under `.agents/skills`.

The Advisory panel's adoption button reads "Adopt Harness SDD (optional)" and is hidden once Harness SDD is present. The npm audit (`workspace.audit`) stays independent of harness ownership and needs only trust.

| Requirement | Verification |
|---|---|
| R5 | byohAdvisoryActions.test.ts: no SDD scaffold offered in a Claude harness; offered in a Harness SDD harness and in an empty workspace; a provider entry point is offered only while that provider is absent. AdvisoryFindings.test.ts: the adoption button is optional and hidden once Harness SDD is present. |
| R6 | byohAdvisoryActions.test.ts: action mapping; native scaffold allowed, foreign refused; entry point re-creation refused; untrusted refused; the audit stays available in every harness. Stale actions keep failing with "Action not found" because the action is resolved from the current profile. The Extension Host check is T4. |

Verified: 886 unit tests.

## T4 — Extension Host

`src/test/integration/advisoryMatrix.ts` builds four roots (Claude-only, custom profile, mixed Harness SDD + Claude, SDD-only). Each root runs through the production detector, the shared registry, the Dashboard provider's dispatch path and the operation gate.

Observed on VS Code 1.147.0:

| Root | Level | Evidence owners | Findings | Offered actions |
|---|---|---|---|---|
| Claude-only | L1 | `claude-code` | `adopt-sdd` (governed lifecycle, workspace-wide), `use-skill-files`, `structure-scattered-files` | none |
| Custom profile | L1 | `team-guides` | `adopt-sdd`, `structure-scattered-files` | none |
| Mixed | L1 | `claude-code`, `harness-sdd` | `adopt-sdd`, `use-skill-files`, `structure-scattered-files` | `scaffold-skill` |
| SDD-only | L1 | `harness-sdd` | `adopt-sdd`, `use-skill-files`, `structure-scattered-files` | `scaffold-skill` |

For comparison, the 0.8.2 baseline in `docs/byoh/v0.9.0.md` returned `cli-without-impl`, `adopt-sdd`, `add-claude-md` and `use-skill-files` for the same Claude fixture.

The suite also asserts:
- every finding carries a scope, and the native evidence comes from the expected owners;
- no Harness SDD scaffold is offered in the Claude root, and a direct scaffold message there is refused;
- `applyHarnessSDD` in the mixed root is refused because Harness SDD is already set up;
- file contents are unchanged after scanning and after every denied action;
- in the SDD-only root, the offered skill scaffold runs through the dispatch path and creates `.agents/skills/<name>/SKILL.md` (positive control).

| Requirement | T4 evidence |
|---|---|
| R1 | Claude root: Claude Code evidence, no missing-instruction findings. |
| R2 | Every finding has a scope. |
| R3 | The same level is reached for equivalent Claude and Harness SDD roots (both L1 with instructions and roles only). |
| R4 | Covered by unit and render tests; the profile carries `unavailableInputs`. |
| R5 | Offered actions follow the present harness. |
| R6 | Refused forged or foreign action, refused re-adoption, allowed native scaffold. |
| R7 | Covered by the unit rescan test. |

Verified: 886 unit tests; seven Extension Host runs; build; 35 project checks.

## Agent pre-review and fixes

An agent code review of f97af80..3a87173 ran before the human closing review. It does not replace that review. All findings are fixed with regression tests:

- **H1 — synthetic roots counted as project instructions.** The Harness SDD manifest node, the Kiro workspace directory and the OpenCode and Windsurf config roots gave their layouts a "Project instructions" category for free. Now only a real Markdown instructions document counts as `context-identity`. The R3 equivalence test runs both with and without instructions on each side, and asserts equal categories, level, unavailable inputs and shared findings.
- **H2 — Cursor and Windsurf rules were not rules.** Those adapters emit rules as `agent`/`subagent` nodes, so the rule evidence never existed and `migrate-to-steering` could not fire per owner. The category now comes from the native file first (`.cursorrules`, `.windsurfrules`, `.clinerules`, `*.mdc`, `*.instructions.md`, `.windsurf/rules/`), the node type second. A detector test with a real Cursor rule and an unclaimed `.clinerules` yields `migrate-to-steering@cursor` plus the workspace-wide instance.
- **H3 and M1 — entry points.** `CLAUDE.md` was hidden and refused when Claude Code was detected through its agents but had no `CLAUDE.md`. A provider's entry point is now native to that format: offered and allowed where the format is present or where no harness exists, refused inside another provider's harness. Creating a file never overwrites. Other files (`AGENTS.md`, `prompts/`, `dependabot.yml`) are format-neutral by design.
- **M2 — `offered()` and the gate saw different providers.** The profile now carries `detectedProviders` from the same detection the gate uses.
- **M3 — read-time legacy matching could hide another owner's finding.** Pre-FEAT-042 bare IDs are migrated once per workspace (`dismissals.ts`, with a stored marker). Stored IDs are then matched exactly.
- **L1.** The `sddDetected` event no longer refires for spec-only workspaces. `.kiro/feature_list.json` counts as a feature registry again. Discovered methodology nodes are still keyed by methodology name, so a manifest-only workspace no longer shows one; this is intended, since a manifest is not a lifecycle.
- **L2.** Advisory actions fail closed when no operation decision is attached.

Dismissal storage moved to `dismissals.ts` to keep `agenticDetector.ts` under the staged-file limit.

Verified after the fixes: 904 unit tests, build.
