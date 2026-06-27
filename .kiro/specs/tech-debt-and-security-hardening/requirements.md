# FEAT-030 — Tech Debt & Security Hardening

> **Feature ID:** FEAT-030
> **Feature Name:** tech-debt-and-security-hardening
> **Type:** chore
> **Priority:** P1
> **Sprint:** Next
> **Agent:** typescript-implementer

---

## Context

This feature closes the security gaps and technical debt identified in the v0.5.1 code review. Requirements are grouped by concern area; each group is independently shippable but they share this single spec to avoid scattered `in_progress` slots.

---

## A — WebView Security

### R1 — CSP nonce generation
- **Pattern:** Ubiquitous
- `getWebviewContent()` SHALL generate a cryptographically random nonce (≥ 16 bytes, base64-encoded) on every call and embed it in the returned HTML.

### R2 — CSP meta header
- **Pattern:** Ubiquitous
- The webview HTML SHALL include a `<meta http-equiv="Content-Security-Policy">` header that restricts `script-src` to scripts carrying the nonce generated in R1, and restricts `default-src` to `'none'` plus `${webview.cspSource}` for styles and images.

### R3 — Nonce on script tag
- **Pattern:** Ubiquitous
- The `<script>` tag that loads the compiled webview bundle SHALL carry the `nonce` attribute matching the value generated in R1.

### R4 — Sandbox without allow-same-origin
- **Pattern:** Ubiquitous
- The `WebviewOptions.enableScripts` sandbox attribute SHALL NOT include `allow-same-origin`; the value SHALL be `'allow-scripts allow-forms'`.

### R5 — Incoming message validation
- **Pattern:** Event
- WHEN `_handleWebviewMessage` receives a message object, it SHALL validate the `type` field against the set of known message types before dispatching any action.

### R6 — Unknown message rejection
- **Pattern:** Unwanted
- IF `_handleWebviewMessage` receives a message whose `type` is not in the known set, THEN it SHALL log a warning to the output channel and SHALL NOT execute any filesystem write or VS Code API call.

---

## B — Architecture: extension.ts decomposition

### R7 — Message handler delegation
- **Pattern:** Ubiquitous
- `extension.ts` SHALL delegate all webview message handling to at least three domain coordinator modules: one for whiteboard/graph operations, one for SDD-panel operations, and one for advisory/detection operations.

### R8 — extension.ts line cap
- **Pattern:** Ubiquitous
- After the refactor, `src/extension.ts` SHALL contain no more than 400 lines (excluding blank lines and comments).

### R9 — No functional regression from refactor
- **Pattern:** Ubiquitous
- All 357 existing unit tests SHALL continue to pass after the extension.ts decomposition without modification.

---

## C — Architecture: FeatureSpecPanel decomposition

### R10 — FeatureSpecPanel max file size
- **Pattern:** Ubiquitous
- `FeatureSpecPanel.tsx` SHALL be split into sub-components such that no single `.tsx` file in the SDD panel tree exceeds 600 lines.

### R11 — Preserved panel behaviour
- **Pattern:** Ubiquitous
- The SDD panel SHALL expose the same user-facing functionality after the split: feature list, spec editor (requirements / design / tasks tabs), and AI-assisted generation button.

---

## D — Type Safety

### R12 — HarnessNode.metadata discriminated union
- **Pattern:** Ubiquitous
- `HarnessNode.metadata` SHALL be typed as a discriminated union keyed on `HarnessNode.type`; `Record<string, any>` SHALL NOT appear as the metadata type in `types.ts`.

### R13 — any count ceiling
- **Pattern:** Ubiquitous
- Production source files under `src/` (excluding test files) SHALL contain no more than 20 occurrences of `: any` or `as any` combined; occurrences that cannot be eliminated SHALL be annotated with an inline `// eslint-disable-next-line` comment explaining why.

---

## E — Dependency Hygiene

### R14 — dagre as devDependency
- **Pattern:** Ubiquitous
- `dagre` and `@types/dagre` SHALL be listed under `devDependencies` in `package.json`, not under `dependencies`.

### R15 — DESIGN.md accuracy
- **Pattern:** Ubiquitous
- `DESIGN.md` §6 Global Constraints SHALL reflect the current parser stack (`yaml` + internal `src/frontmatter.ts`) and SHALL NOT reference `gray-matter`.

---

## F — Test Coverage

### R16 — Webview utility coverage
- **Pattern:** Ubiquitous
- `src/webview/layoutUtils.ts` and `src/webview/profileToNodes.ts` SHALL each have at least one dedicated Vitest test file covering their exported pure functions.

### R17 — Message bus typed discriminator coverage
- **Pattern:** Ubiquitous
- The known-message-type set introduced in R5 SHALL have at least one test asserting that a valid message is accepted and at least one test asserting that an unknown message type is rejected.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| Webview scripts only execute with a valid nonce | R1, R2, R3 |
| `allow-same-origin` absent from webview sandbox | R4 |
| Unknown message types never trigger writes | R5, R6 |
| `extension.ts` ≤ 400 lines, behaviour unchanged | R7, R8, R9 |
| No `.tsx` file in SDD panel > 600 lines | R10, R11 |
| `HarnessNode.metadata` fully typed | R12, R13 |
| `dagre` not in production bundle | R14 |
| `DESIGN.md` references `yaml`, not `gray-matter` | R15 |
| `layoutUtils` and `profileToNodes` have tests | R16 |
| Message discriminator has passing tests | R17 |
