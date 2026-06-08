# Design — Open Markdown File in VS Code Editor

> Feature FEAT-014. Technical design for fixing the "Edit File" button visibility and discoverability.

---

## 1. Root Cause Analysis

The FEAT-009 implementation added `openMarkdownFile` support at two levels:

| Layer | Status |
|-------|--------|
| Extension handler (`extension.ts` `case 'openMarkdownFile'`) | ✅ Working |
| Button in Description tab (icon-only, `codicon-go-to-file`) | ❌ Invisible if codicons absent |
| Button in Markdown tab header (icon-only, `codicon-go-to-file`) | ❌ Invisible if codicons absent |
| Button in detail panel header (text + icon) | ❌ Missing |

**Why codicons may not render:** The webview HTML only loads `webview.css` from the extension bundle. The `@vscode/webview-ui-toolkit` registers its web components, but the underlying codicon font files are not guaranteed to be accessible from a sandboxed webview unless the extension explicitly serves them as webview resources. `appearance="icon"` buttons with only a codicon child render as invisible zero-width elements when the font is missing.

---

## 2. Fix Strategy

### 2.1 Panel Header Button (R1, R2)

Add to the right side of the detail panel header, **between** the delete button and the close button:

```tsx
{/* Only for skill/subagent nodes */}
{(selectedNode.type === 'skill' || selectedNode.type === 'subagent') && (
    <vscode-button
        appearance="secondary"
        title="Open in VS Code editor"
        onClick={() => {
            vscode.postMessage({ type: 'openMarkdownFile', nodeId: selectedNode.id, nodeType: selectedNode.type });
            setDetailTab('markdown'); // R4: switch tab
        }}
    >
        ✏ Edit File
    </vscode-button>
)}
```

**Why `appearance="secondary"` with text:** Secondary buttons always render with visible text and background, regardless of codicon loading. The `✏` emoji provides an icon-like visual cue that works without any font dependency.

### 2.2 Remove Redundant Icon Buttons (R5)

**Description tab:** Remove the `<vscode-button appearance="icon">` + `<span className="codicon codicon-go-to-file">` that is placed next to the "Mission / Prompt" label. The header button replaces this.

**Markdown tab:** Remove the `<vscode-button appearance="icon">` from the markdown tab's sub-header. Keep the file path label (`mdContent?.filePath`). The header button replaces the open-file action.

### 2.3 Tab Auto-Switch (R4)

The onClick handler sets `setDetailTab('markdown')` so the user sees the file preview in the panel while editing in the VS Code editor. This requires passing a `setDetailTab` state setter (already available in `index.tsx` as `const [detailTab, setDetailTab]`).

---

## 3. No Extension Changes Needed

The `extension.ts` handler for `openMarkdownFile` is correct and complete:
- Resolves path by node type ✅
- Opens with `vscode.window.showTextDocument` with `preserveFocus: true` ✅
- Shows warning if file not found ✅

No changes needed in `extension.ts`, `harnessParser.ts`, or any backend file.

---

## 4. Discarded Alternatives

| Alternative | Reason discarded |
|-------------|-----------------|
| Fix codicon CSS loading (add codicon font to webview resources) | Complex setup, fragile across VS Code versions; text button is simpler and more robust |
| Keep icon-only button, add `aria-label` text | Still invisible if codicon font is absent |
| Add button to node's right-click context menu on canvas | Requires extra interaction; header button is more direct |
| Add button to CustomNode directly | Clutters the node card; detail panel header is the right place |
