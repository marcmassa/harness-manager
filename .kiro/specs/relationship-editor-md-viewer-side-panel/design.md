# Design: relationship-editor-md-viewer-side-panel (FEAT-009)

> Technical decisions to implement feature FEAT-009. Builds on existing FEAT-004 (graph editor), FEAT-007 (subagent-skill relationships), and FEAT-008 (UI/UX visual design).

## Summary

This feature adds three capabilities to the Harness Manager whiteboard:

1. **Edge deletion & modification** — users can delete edges by clicking on them (with confirmation) or pressing the Delete key, and can change edge labels via right-click context menu. Persists changes to `agentic.json` and `SUBAGENT.md`.
2. **MD file viewer** — clicking a node shows the raw content of its SUBAGENT.md / SKILL.md file in the detail panel, using a read-only code viewer. Falls back gracefully if the file doesn't exist.
3. **Side panel for entity creation** — replaces the current inline "Add Entity" form with a proper side panel (VS Code secondary sidebar or webview panel) that includes all fields from the Agent Skills specification.

## Affected Files

| File | Action | Reason |
|---------|--------|-------|
| `src/webview/index.tsx` | modify | Add side panel component, MD viewer render, edge deletion/mutation handlers, replace inline Add Entity form |
| `src/webview/WhiteboardCanvas.tsx` | modify | Add edge click handler, right-click context menu on edges, Delete key listener, edge removal UI |
| `src/webview/components/CustomNode.tsx` | modify | (minimal) Ensure node click passes full metadata for MD file path resolution |
| `src/webview/components/EntitySidePanel.tsx` | create | New side panel component with Agent Skills form for creating subagents/skills |
| `src/webview/components/MDViewer.tsx` | create | Read-only Markdown viewer component for displaying SUBAGENT.md / SKILL.md content |
| `src/webview/components/EdgeContextMenu.tsx` | create | Context menu component for edge actions (delete, change label) |
| `src/extension.ts` | modify | Add message handlers for `deleteEdge`, `updateEdgeLabel`; expose raw file content endpoint |
| `src/harnessWriter.ts` | modify | Add `deleteEdge()`, `updateEdgeLabel()` methods |
| `src/types.ts` | modify | Add `MarkdownFileContent` type for MD file data transfer |
| `src/harnessParser.ts` | modify | Add method to read raw Markdown file content for a given node ID |

## Signatures and Structures

### New Types (in `src/types.ts`)

```typescript
export interface MarkdownFileContent {
    nodeId: string;
    filePath: string;
    content: string;
    exists: boolean;
}

export type EdgeLabel = 'manages' | 'uses' | 'executing';
```

### New Message Types (webview ↔ extension)

```typescript
// Webview → Extension
{ type: 'getMarkdownContent', nodeId: string }
{ type: 'deleteEdge', edgeId: string, source: string, target: string }
{ type: 'updateEdgeLabel', edgeId: string, source: string, target: string, label: EdgeLabel }

// Extension → Webview
{ type: 'markdownContent', content: MarkdownFileContent }
{ type: 'edgeDeleted', edgeId: string }
{ type: 'edgeLabelUpdated', edgeId: string, label: EdgeLabel }
```

### EntitySidePanel Component

```typescript
interface EntitySidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateEntity: (entity: EntityFormData) => void;
}

interface EntityFormData {
    entityType: 'subagent' | 'skill';
    name: string;         // kebab-case, validated
    description: string;  // 1-1024 chars
    // Skill-only fields (Agent Skills spec)
    license?: string;
    compatibility?: string;
    author?: string;
    version?: string;
    // Subagent-only fields
    permissionPreset?: 'read-only' | 'read-write' | 'custom';
}
```

### MDViewer Component

```typescript
interface MDViewerProps {
    content: MarkdownFileContent | null;
    isLoading: boolean;
}
```

### EdgeContextMenu Component

```typescript
interface EdgeContextMenuProps {
    edge: Edge | null;
    position: { x: number; y: number };
    onDelete: (edge: Edge) => void;
    onChangeLabel: (edge: Edge, newLabel: EdgeLabel) => void;
    onClose: () => void;
}
```

### New HarnessWriter Methods

```typescript
class HarnessWriter {
    // Existing methods...
    
    public async deleteEdge(source: string, target: string): Promise<void> {
        // Remove from agentic.json subagent[].skills[]
        // Remove from SUBAGENT.md ## Skills section
    }
    
    public async updateEdgeLabel(source: string, target: string, newLabel: EdgeLabel): Promise<void> {
        // Update edge label in agentic.json (where applicable)
        // For 'manages' edges: update relationship type
        // For 'uses' edges: only label in persisted data changes
    }
}
```

## Algorithm / Flow

### Edge deletion flow
```
1. User clicks on edge in whiteboard
2. EdgeContextMenu appears at click position with "Delete" and "Change Label" options
3. User clicks "Delete"
4. Confirmation dialog appears (vscode.window.showWarningMessage with "Yes"/"Cancel")
5. If confirmed:
   a. Send { type: 'deleteEdge', source, target } to extension
   b. Extension calls harnessWriter.deleteEdge(source, target)
   c. Extension re-parses and sends updated data to webview
   d. Local graph removes the edge
```

### MD file viewer flow
```
1. User clicks on a node
2. Webview sends { type: 'getMarkdownContent', nodeId } to extension
3. Extension determines the file path from node type:
   - agent/subagent → .agents/subagents/{nodeId}/SUBAGENT.md
   - skill → .agents/skills/{nodeId}/SKILL.md
4. Extension reads file content (or returns exists: false)
5. Extension sends { type: 'markdownContent', content: {...} } to webview
6. MDViewer component renders content with monospace styling, scrollable
```

### Side panel flow
```
1. User clicks "Add Entity" button in toolbar
2. Side panel slides in from the right (VS Code secondary sidebar area)
3. EntitySidePanel renders with entity type selector
4. User fills form fields (name, description, optional Agent Skills fields)
5. User clicks "Create"
   a. Validate fields: name is kebab-case, description non-empty
   b. Send { type: 'createNode', nodeType, name, description, ... } to extension
   c. Extension creates files
   d. Extension re-parses and sends updated data
   e. Side panel closes automatically on success
6. User clicks "Cancel" or X button → panel closes
```

## Error Handling

| Condition | Response |
|-----------|-----------|
| Edge delete fails on disk | Show error via `vscode.window.showErrorMessage()` |
| MD file not found | `MDViewer` shows placeholder: "No Markdown file found for `{nodeId}`" |
| Invalid kebab-case name | Side panel shows inline validation error: "Name must be lowercase with hyphens only" |
| Description > 1024 chars | Side panel shows character counter and validation error |
| Duplicate entity name | Extension returns error, webview shows "Entity already exists" |

## Discarded Alternative

**Alternative 1: Inline edge action buttons**
Instead of a context menu, considered showing small action buttons (delete X, edit pencil) directly on the edge path on hover. This is what many graph editors do (e.g., Figma, Miro). Discarded because React Flow does not natively support embedding interactive elements inside edge paths, and custom SVG edge types would add significant complexity. A floating context menu is simpler, more accessible, and matches VS Code's native interaction patterns.

**Alternative 2: Separate webview panel for entity creation**
Considered opening a completely separate VS Code webview panel (via `vscode.window.createWebviewPanel()`) for the entity creation form. Discarded because it would create a non-associated window that feels disconnected from the whiteboard, and managing state between two webviews adds complexity. A slide-out panel within the same webview (styled like VS Code's secondary sidebar) keeps everything in one context and is simpler to implement.

**Alternative 3: Modal dialog for MD viewer**
Considered showing MD content in a modal overlay on top of the whiteboard. Discarded because the existing detail panel (footer area) already serves this purpose for node metadata, and extending it with a tab or toggled view for raw file content is more consistent with the current UX.

## Risks and Edge Cases

- **Risk**: Edge deletion in `createEdge` flow currently only handles subagent→skill relationships. Deleting 'manages' or 'executing' edges requires different persistence logic.
  - *Mitigation*: `deleteEdge` in harnessWriter checks edge label and handles each type appropriately: 'uses' removes from subagent.skills[] and ## Skills section; 'manages' removes from subagents[] array; 'executing' removes from feature_list.json agent assignment.
- **Risk**: Large MD files could overwhelm the detail panel.
  - *Mitigation*: limit rendered content to first 200 lines with a "Show more" expand button.
- **Risk**: Side panel on smaller VS Code windows could crowd the whiteboard.
  - *Mitigation*: side panel takes at most 40% of the webview width, with a minimum 300px whiteboard area.
- **Edge case**: Node has no metadata (freshly created, not yet on disk) → `MDViewer` shows the not-found placeholder.
- **Edge case**: Right-click context menu on edge goes off-screen → menu position is clamped to viewport bounds.
