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

## T3 — Item data and text

`treeModels.ts` now carries structured data instead of a ready-made tooltip string:
- resources: name, type, path, load mode, tokens, score, tier, finding count, owner, capabilities, denied operations;
- providers: the FEAT-044 session cost;
- findings: rule id, dimension and path.

It also sorts:
- Sources resources by type (agent, subagent, skill, steering, hook, then others), then by name;
- Findings resources by their most severe finding, and findings by severity, then by title.

`treeText.ts` formats all text:
- descriptions, which leave out unknown or unscored parts;
- token estimates: `~640 tok`, `~1.2k tok`, `~12k tok`;
- Markdown tooltips, with every user-derived string escaped by `md()`.

## T4 — Rendering

`harnessTrees.ts` renders:
- **Open Dashboard** as the first item of a view with data. From Findings it opens the Advisory tab, through the new optional tab argument of `openDashboard`.
- Provider and type icons from `dist/icons`.
- Severity product icons coloured with the `problems*Icon.foreground` theme colours.
- Untrusted `MarkdownString` tooltips, which allow theme icons only.
- An accessibility label on every item.

The Open Dashboard title action is on both views, with the generated dashboard icon.

| Requirement | Verification |
|---|---|
| R4 | harnessTrees.test.ts: provider icon; severity icons and colours. |
| R5 | harnessTrees.test.ts: the first item in each view opens the Dashboard (on Advisory from Findings); absent without data; title action on both views with the icon. |
| R6 | treeText.test.ts: description order with unknown and unscored parts left out; token format table; tooltip content. |
| R7 | treeText.test.ts: per-session cost and breakdown; not evaluated; count only without a report. |
| R8 | treeText.test.ts and harnessTrees.test.ts: resource type, name and count; finding title as label, rule id as description; tooltip with rule, severity, dimension, detail and path:line. |
| R9 | treeText.test.ts and treeModels.test.ts: type order, then name; most severe first. |
| R10 | treeText.test.ts: hostile names and labels are escaped, with no link injection. harnessTrees.test.ts: accessibility label on every item; no trusted tooltip. |
| R11 | treeText.test.ts: no framework name unless a provider label supplies it. |

## T5 — Package and Extension Host

| Measure | FEAT-047 | FEAT-046 |
|---|---|---|
| VSIX | 334,437 B | 345,119 B (86 %) |
| `dist/icons/*` in the VSIX | — | 7,506 B: 3,718 B compressed data plus zip headers for 20 entries |

The rest of the increase is code: tree text, the shared icon module in both bundles, and the badge component.

Extension Host: all 19 runs pass.

| Requirement | Verification |
|---|---|
| R12 | Measured by deleting `extension/dist/icons/*` from the packaged VSIX: 7,506 B, within 8 KB. The package gate passes under 400,000 B. |

**Pending, by hand:** a look at the Sources and Findings views in light, dark and high-contrast themes. This is left for the maintainer, because an agent cannot view the running sidebar here. The icons were checked on a rendered contact sheet.
