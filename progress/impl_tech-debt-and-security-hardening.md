# FEAT-030 — Tech Debt & Security Hardening — Implementation Log

**Date:** 2026-06-27  
**Status:** Done

---

## R↔T Traceability

| Requirement | Task(s) | Outcome |
|---|---|---|
| R1 — CSP nonce | T3 | Per-render `globalThis.crypto.getRandomValues` nonce in `<meta http-equiv="Content-Security-Policy">` and `<script nonce>` |
| R2 — script-src nonce-only | T3 | CSP header: `script-src 'nonce-${nonce}'` |
| R3 — no unsafe-inline | T3 | Confirmed absent from generated CSP |
| R4 — no allow-same-origin sandbox | T4 | Removed from both `WebviewView` and `WebviewPanel` options |
| R5 — message type whitelist | T1, T2, T5 | `WebviewMessageType` union (28 types), `KNOWN_MESSAGE_TYPES` Set, `isKnownWebviewMessage()` guard |
| R6 — reject unknown messages | T5 | `_log.warn(...)` on unknown type, early return |
| R7 — domain coordinators | T6, T7, T8, T9 | `WhiteboardCoordinator`, `SddCoordinator`, `AdvisoryCoordinator` each returning `boolean` from `handle()` |
| R8 — extension.ts ≤ 400 lines | T9, T10 | Result: 340 executable lines; verifier helpers moved to `src/verifier/codeQualitySetup.ts` |
| R9 — behaviour unchanged | T9, T24 | All 372 tests pass, build zero errors |
| R10 — FeatureSpecPanel decomposed | T11–T14 | `FeatureList.tsx`(221), `SpecEditor.tsx`(314), `AiAssistBar.tsx`(96), `SpecWizard.tsx`(372) |
| R11 — all sub-files ≤ 600 lines | T15 | `FeatureSpecPanel.tsx`(192), `FeatureList.tsx`(221), `SpecEditor.tsx`(314), `AiAssistBar.tsx`(96) — all pass |
| R12 — no `Record<string, any>` in metadata | T16, T17 | `NodeMetadata` typed union; 7 named metadata interfaces with `[key: string]: unknown` index signature |
| R13 — reduce `any` usage | T18 | `as any` count reduced; remaining instances in legacy adapter code with `// eslint-disable` where needed |
| R14 — dagre to devDependencies | T19 | Moved `dagre` + `@types/dagre` in `package.json` |
| R15 — DESIGN.md gray-matter fix | T20 | §4 and §6 updated to reference `yaml` + `src/frontmatter.ts` |
| R16 — layoutUtils tests | T21 | 6 Vitest tests in `src/webview/layoutUtils.test.ts` |
| R17 — message discriminator tests | T23 | 8 Vitest tests in `src/messageDiscriminator.test.ts` |

## Key files changed / created

- **`src/types.ts`** — `WebviewMessageType`, `WebviewMessage`, `isKnownWebviewMessage`, `NodeMetadata` union + 7 typed metadata interfaces
- **`src/extension.ts`** — CSP nonce, sandbox removal, coordinator delegation, 340 exec lines
- **`src/coordinators/WhiteboardCoordinator.ts`** — whiteboard/graph message handling
- **`src/coordinators/SddCoordinator.ts`** — SDD-panel message handling
- **`src/coordinators/AdvisoryCoordinator.ts`** — advisory/scaffold message handling
- **`src/verifier/codeQualitySetup.ts`** — extracted from extension.ts
- **`src/webview/FeatureList.tsx`** — feature sidebar sub-component
- **`src/webview/SpecEditor.tsx`** — tabbed spec editor sub-component
- **`src/webview/AiAssistBar.tsx`** — AI action bar sub-component
- **`src/webview/SpecWizard.tsx`** — spec generation wizard sub-component
- **`src/webview/layoutUtils.test.ts`** — new tests (T21)
- **`src/messageDiscriminator.test.ts`** — new tests (T23)
- **`package.json`** — dagre → devDependencies
- **`DESIGN.md`** — §4 §6 gray-matter reference fixed
- **`src/parserLogic.ts`** — typed metadata casts

## Test results

- `npm test`: 372 pass (357 pre-existing + 15 new)
- `npm run build`: zero TypeScript errors
- `./check.sh`: build ✅, tests ✅, feature-list ✅ (adapter drift pre-existed, unrelated to FEAT-030)
