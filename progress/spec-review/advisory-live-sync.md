# FEAT-031 — advisory-live-sync

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

T6 is an explicit manual smoke check of spinner, disabled state, refresh and empty state; it remains unexecuted in this review.

Evidence sources:

- [src/webview/AdvisoryPanel.tsx](../../src/webview/AdvisoryPanel.tsx)
- [src/webview/AdvisoryPanel.test.ts](../../src/webview/AdvisoryPanel.test.ts)
- [src/coordinators/AdvisoryCoordinator.ts](../../src/coordinators/AdvisoryCoordinator.ts)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T6](../../.kiro/specs/advisory-live-sync/tasks.md#L22) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/webview/AdvisoryPanel.tsx`, `src/webview/AdvisoryPanel.test.ts` |
