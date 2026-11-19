# FEAT-046 — Tree view presentation and Dashboard access

## T1 — Icon set

`src/shared/typeIcons.ts` is the single definition of the ten icons, all stroke drawings on a 16×16 grid:

| Icon | Drawing |
|---|---|
| agent | person |
| subagent | robot |
| skill | lightning bolt |
| steering | steering wheel |
| hook | hook |
| feature | flag |
| terminal | terminal prompt |
| document | document |
| provider | stacked layers |
| dashboard | dashboard grid |

The module also has one light and one dark accent per icon, the type-to-icon map, `svgFor()` and `iconThemeCss()`. It imports neither `vscode` nor the DOM.

On every build, `esbuild.js` regenerates `dist/icons/<name>-{light,dark}.svg` (20 files, 7.5 KB uncompressed) from that module.

Accent contrast:
- light, against `#F3F3F3`: from 4.6:1 (feature) to 6.2:1 (terminal);
- dark, against `#252526`: from 6.8:1 (hook) to 8.3:1 (feature).

A contact sheet of both themes was checked by eye.

## T2 — Whiteboard badge

`components/TypeIcon.tsx` inlines the same paths. Its stroke is `var(--hd-icon-<name>)`, which `iconThemeCss()` sets per VS Code body theme class; the CSS is injected with `CONTROLS_CSS`. The `CustomNode` type badge now shows the icon and the type name, replacing ⚡ Agent, ▸ Subagent, ◆ Skill, ▣ Feature, ⚙️ Steering and 🔌 Hook.

| Requirement | Verification |
|---|---|
| R1 | typeIcons.test.ts: every `NodeType` maps to an icon; discovered types map to their kind; unknown types map to document. |
| R2 | typeIcons.test.ts: contrast of at least 3:1 per accent and theme; the light and dark files differ only in colour. |
| R3 | typeIcons.test.ts: the generated files equal `svgFor()`. TypeIcon.test.ts: whiteboard badges use the same paths and theme variables, and no old glyph remains. |

Changing `CustomNode.tsx` meant splitting it, because the staged-file limit is 20,000 bytes and the file was 34,587. The JSX moved verbatim into new files:
- `NodeBadges.tsx`: run, suggestion, status, discovery, owner and mismatch badges.
- `NodeLinkPicker.tsx`: the inline link picker and `SkillOption`.
- `nodeParts.tsx`: `FeatureNode` and `RoundNodeButton`. The Run and link (+) buttons had duplicated their whole style and hover logic; they now share `RoundNodeButton`.

The last-run badge now shows ▶ instead of ⚡, which now means skill.
