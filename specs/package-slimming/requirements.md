# FEAT-047 — Package slimming and scope alignment

Proposed for Harness Dashboard v0.9.0, from the maintainer's decision on 2026-11-19 after a size review. The goal is room in the 400,000-byte VSIX budget, so that FEAT-046 and later work fit. It also removes code and features that no longer serve the BYOH purpose: see, check and price the agent harness a workspace already has.

## Context

Measured on `main` at 8c0a784: the VSIX is 390,247 bytes (97 % of budget).

| Item | Size in the VSIX (compressed) | Status |
|---|---|---|
| `@vscode/webview-ui-toolkit` plus `@microsoft/fast-*` in `dist/webview.js` | ~43 KB (172 KB minified) | The toolkit is deprecated by Microsoft. Outside dead code it serves 12 tags of four kinds: `vscode-button`, `vscode-badge`, `vscode-text-area`, `vscode-progress-ring`. |
| `media/icon.png`, 128×128 RGBA, not palettised | 16.6 KB | Stored without compression gains. |
| Supply-chain audit (FEAT-036): `src/supply-chain/`, `supplyChainRules.ts`, `SupplyChainSection.tsx`, the `runSupplyChainAudit` command and the `workspace.audit` operation | ~2.4 KB, plus the only non-frontmatter use of `yaml` | It audits npm dependencies, not the agent harness. |
| Specs Manager (Timeline) tab | ~15 KB | Always shown, though only a provider with feature or spec data gives it content. |
| `SDDManagerPanel.tsx`, `TimelineView.tsx`, `components/EntitySidePanel.tsx`, the `SDDManagerProvider` class, `dagre` and `@types/dagre` | none shipped, ~70 KB of source | Unreachable from any entry point, or unused. |

## Requirements

### R1 — Native controls

The webview SHALL render buttons, badges, text areas and progress indicators with native HTML elements styled from VS Code theme variables, and SHALL NOT depend on `@vscode/webview-ui-toolkit` or `@microsoft/fast-*`.

### R2 — Control behaviour

Each native control SHALL:
- be reachable and operable with the keyboard;
- show a visible focus outline from `--vscode-focusBorder`;
- reflect a disabled state to both the user and assistive technology;
- give a progress indicator an accessible label.

Every existing control SHALL keep its label, action and disabled condition.

### R3 — Icon image

`media/icon.png` SHALL stay 128×128. It SHALL be at most 8 KB. No pixel channel SHALL differ from the current image by more than 8 out of 255.

### R4 — Supply-chain removal

The extension SHALL NOT contribute, register or run:
- a supply-chain or npm audit command;
- the `workspace.audit` operation;
- supply-chain Advisory rules or signals;
- the supply-chain section of the Advisory tab.

An earlier dismissal of a supply-chain suggestion SHALL be ignored without error.

### R5 — Specs Manager availability

The Specs Manager tab SHALL appear only WHILE the scan contains at least one feature milestone or spec entry from any provider. WHEN the panel opens or restores on a tab that is not available, the Dashboard SHALL show the whiteboard instead.

### R6 — Dead code

The repository SHALL NOT contain:
- source files that no build entry point reaches, other than type-only modules, test helpers and dev scripts;
- the `SDDManagerProvider` class;
- the `dagre` and `@types/dagre` dependencies.

A unit test SHALL fail when a new unreachable source file appears.

### R7 — Budget

The packaged VSIX SHALL be at most 350,000 bytes, and the VSIX gate SHALL still enforce the 400,000-byte budget.

### R8 — Documentation

README, CHANGELOG, DESIGN.md and the BYOH feature compatibility matrix SHALL describe:
- the removed supply-chain feature;
- the conditional Specs Manager tab;
- the new package size.
