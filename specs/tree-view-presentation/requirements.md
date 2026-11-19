# FEAT-046 — Tree view presentation and Dashboard access

Proposed for Harness Dashboard v0.9.0, from the maintainer's review of FEAT-045 (2026-11-19):

- Items in the Sources and Findings lists lack distinguishable icons.
- At a glance the Dashboard seems to have been removed.
- Each item shows too little information.

The analysis and the FEAT-045 behavior are unchanged. This feature changes only how the two native views present the shared scan, Advisory profile and Optimizer report.

## Context

Measured on `main` at 8c0a784:

| Today | Effect |
|---|---|
| Provider groups and Findings resource items have no icon; resource items use generic product icons (`account`, `person`, `tools`, `compass`, `zap`) and unknown types fall back to `file`. | Types are hard to tell apart; rows without icons look unfinished. |
| The only route to the Dashboard is a `$(window)` toolbar icon on Sources and the Command Palette. | Users read the FEAT-045 change as the Dashboard being removed. |
| A resource item shows its native path, then `type · load mode`. Its plain-text tooltip lists owner, path, capabilities and denied operations. | The token estimate, score, tier and finding count already in the Optimizer report are not shown. A long path pushes the description out of view. |
| A provider group shows only `N resources`. | The per-session cost from FEAT-044 is not shown. |
| A finding item shows `ruleId title` and its severity word. | The severity is repeated as text, and the rule id takes up the label. |

## Requirements

### R1 — Type icons

Each resource item in the Sources and Findings views SHALL show an icon for its type, drawn from an SVG set bundled with the extension:

| Type | Icon |
|---|---|
| agent | a person |
| subagent | a robot |
| skill | a lightning bolt |
| steering | a steering wheel |
| hook | a hook |
| feature | a flag |
| `discovered-*` | the icon of the type they correspond to |
| `cli-install` | a terminal |
| any other type | a document |

### R2 — Theme legibility

Each type icon SHALL ship a light and a dark variant. Each SHALL use one accent colour per type with a contrast ratio of at least 3:1 against the default light and dark sidebar backgrounds (`#F3F3F3`, `#252526`).

### R3 — Group and severity icons

Each provider group SHALL show a provider icon from the bundled set. Each finding item SHALL keep the product severity icon (`error`, `warning`, `info`) coloured with the matching `problemsErrorIcon`, `problemsWarningIcon` or `problemsInfoIcon` theme colour, so findings read like the Problems view.

### R4 — Dashboard entry

WHILE the Sources view lists at least one provider, its first item SHALL be **Open Dashboard**, with the Dashboard icon, which opens or reveals the Dashboard panel. WHILE the Findings view lists at least one finding, its first item SHALL be **Open Dashboard**, which opens or reveals the panel on the Advisory tab. The Open Dashboard title action SHALL appear on both views with the Dashboard icon.

### R5 — Resource item information

A Sources resource item SHALL show:
- its name as the label;
- as its description, in this order and leaving out each part that is unknown: type, load mode, the token estimate (`~1.2k tok`), and the Optimizer score.

Its tooltip SHALL be Markdown and give:
- the name and native path;
- the owner;
- the type and load mode;
- the token estimate;
- the score and tier;
- the finding count;
- the capability levels;
- each denied operation with its reason (FEAT-041 R3).

### R6 — Provider group information

A provider group SHALL show, as its description, its resource count and, when the provider was evaluated, its per-session token cost (baseline plus catalog, FEAT-044). Its tooltip SHALL break that cost down into baseline, catalog, on-demand and unpriced. A provider that declares no load mode SHALL say that its cost was not evaluated.

### R7 — Finding item information

In the Findings view:
- A resource item SHALL show the type icon of its resource, its name, and as its description the finding count.
- A finding item SHALL show the finding title as its label and the rule id as its description.
- A finding item's tooltip SHALL be Markdown with the rule id, severity, dimension when known, detail and path with line.

### R8 — Neutral presentation

No icon, label, description or tooltip added by this feature SHALL name or recommend a framework. Provider names SHALL come only from the provider's own label.

### R9 — Package budget

The bundled icon set SHALL add at most 8 KB to the packaged VSIX, and the VSIX gate SHALL pass under its 400,000-byte budget.
