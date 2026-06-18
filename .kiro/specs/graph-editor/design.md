# Design: graph-editor (FEAT-004)

## Architecture
This feature adds the "Write" capability to the extension. It requires a robust synchronization mechanism between the React state and the disk.

- **Frontend Actions:**
  - **Node Creation:** A "Plus" button or context menu triggers a modal to input the name and type.
  - **Edge Connection:** `reactflow`'s `onConnect` handler triggers a message to the Extension Host.
  - **Metadata Editing:** The detail panel from Phase 3 will be upgraded to an editable form.
- **Backend Persistence Service:**
  - A `HarnessWriter` service in the Extension Host.
  - **Safe Updates:** Uses a "Read-Modify-Write" pattern for JSON to avoid data loss.
  - **Template Injection:** Uses base templates when creating new `.md` files.
- **Synchronization:**
  - After a successful write, the `FileSystemWatcher` (from Phase 2) will naturally trigger a re-parse, keeping the UI in sync without manual state management.

## Message Schema
- `createNode`: `{ type: NodeType, name: string, metadata: any }`
- `updateNode`: `{ id: string, metadata: any }`
- `deleteNode`: `{ id: string, type: NodeType }`
- `createEdge`: `{ source: string, target: string }`

## Discarded Alternatives
- **Alternative: In-memory state only with a manual "Save" button.**
  - *Reason for discarding:* Inconsistent with the VS Code "live editor" feel. Autosave/Immediate persistence is more intuitive for a whiteboard.
- **Alternative: Editing agentic.json as a raw text string in the Webview.**
  - *Reason for discarding:* Defeats the purpose of a visual graph editor. The UI should abstract the underlying file format.

## Risks
- **Risk:** Concurrent edits (Visual UI vs. Manual File Edit).
  - *Mitigation:* The parser's watcher handles file-to-UI sync. For UI-to-file, we'll implement simple locking or rely on VS Code's native file system protection.

## External Dependencies
- `gray-matter` (to stringify frontmatter)
