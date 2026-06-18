# Design: ui-ux-visual-design (FEAT-008)

## Architecture

This feature improves the visual design of the existing webview components using CSS variables, consistent spacing, and interaction feedback. No new components are needed.

### Layout Spacing Scale (R1)
Apply a 4px-base spacing scale across all components:
- `4px` — tight icon spacing, badge padding
- `8px` — element gap in flex containers
- `16px` — panel padding, header margins
- `24px` — section margins, timeline spacing

### Node Type Visual Distinction (R2)
```
┌──────────────────┐     ┌──────────────────┐     ╭──────────────╮     ┌──────────────┐
│  AGENT           │     │  SUBAGENT        │     │   SKILL      │     │ FEAT-001     │
│  ┌──────────────┐│     │  ┌──────────────┐│     │  ──────────  │     │  Title       │
│  │ Label        ││     │  │ Label        ││     │  Label       │     └──────────────┘
│  └──────────────┘│     │  └──────────────┘│     ╰──────────────╯
└──────────────────┘     └──────────────────┘
  2px accent border        Button bg fill       Pill rounded 20px     Badge bg
  Square corners           Rounded 8px          Remote color          Rounded 4px
```

### Edge Visual Styles (R3)
| Label | Style | Color |
|-------|-------|-------|
| `manages` | Solid, 2px | `--vscode-focusBorder` |
| `uses` | Dashed, 2px | `--vscode-statusBarItem-remoteBackground` |
| `executing` | Animated dots, 3px | `--vscode-debugIcon-breakpointForeground` |

### Detail Panel Animation (R8)
```css
@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
```

### Affected Files
| File | Changes |
|------|---------|
| `src/webview/components/CustomNode.tsx` | Spacing scale, node shape per type, hover effect, selection ring, edge handle visibility |
| `src/webview/WhiteboardCanvas.tsx` | Edge style mapping, React Flow default edge options |
| `src/webview/TimelineView.tsx` | Empty state illustration, spacing refinement |
| `src/webview/index.tsx` | Detail panel animation, consistent spacing, skeleton loading |
| `src/webview/layoutUtils.ts` | Edge label styling configuration |

## Risks
- **Risk**: Edge styles might not render identically across platforms (macOS, Windows, Linux).
  - *Mitigation*: Use only CSS-based styles (no custom SVGs) that React Flow supports cross-platform.

## External Dependencies
- React Flow edge options API (built-in)

## Discarded Alternatives
- **Alternative**: Replace react-flow with a D3.js custom graph.
  - *Reason*: Too much effort for visual-only improvements. React Flow handles theming well.
