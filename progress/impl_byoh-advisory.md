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
