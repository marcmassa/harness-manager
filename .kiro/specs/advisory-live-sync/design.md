# FEAT-031 — Advisory Live Sync — Design

---

## Summary

Two phases bridge the gap between the Advisory panel's file-system scan and the live state of the tool.

**Phase 1** adds a Re-scan button to `AdvisoryPanel.tsx` with proper loading state and wires a new `rescanAgentic` message type through the existing message-dispatch chain (webview → `AdvisoryCoordinator` → `AgenticDetector.scan()`).

**Phase 2** installs a unidirectional state bus:

```
Any write (Whiteboard / SDD / editor)
        │
        ▼  debounce 1 s
AgenticDetector.scan(graphContext)
        │
        ├─ emit 'scanComplete'  ─────────────────────────────────────────────────────────────────
        │                                                                                       │
        │  post { type: 'advisoryProfile', profile }        post { type: 'architectureSummary' }
        │                                                                                       │
        ▼                                                                                       ▼
  AdvisoryPanel (full profile)                              Tab header maturity badge (all tabs)
```

The advisory engine also receives a `GraphContext` built from the extension host's in-memory graph data so that its suggestions reflect the actual visual model, not just the filesystem.

---

## Affected Files

| File | Action | Reason |
|---|---|---|
| `src/types.ts` | modify | Add `'rescanAgentic'` to `WebviewMessageType`; add `GraphContext` interface; add `ArchitectureSummary` interface |
| `src/agentic-detector/agenticDetector.ts` | modify | `scan()` accepts optional `GraphContext`; stores it on profile; `startWatching()` adds `.kiro/specs/**` watcher; `_previousScanTimer` for post-write debounce exposed as `scheduleScan()` |
| `src/agentic-detector/advisoryEngine.ts` | modify | `generate()` receives `GraphContext`; add S-GC01, S-GC02 graph-aware rules |
| `src/agentic-detector/types.ts` | modify | Add `GraphContext` to `AgenticProfile`; add `ArchitectureSummary` type |
| `src/coordinators/AdvisoryCoordinator.ts` | modify | Handle `rescanAgentic`; fix dismissal to delegate to `AgenticDetector.dismissSuggestion()` |
| `src/coordinators/WhiteboardCoordinator.ts` | modify | After mutating operations, call `this._scheduleScan()` callback |
| `src/coordinators/SddCoordinator.ts` | modify | After mutating operations, call `this._scheduleScan()` callback |
| `src/extension.ts` | modify | Build `GraphContext` before each scan; wire `scheduleScan` into coordinators; send `architectureSummary` on scan start and completion |
| `src/webview/AdvisoryPanel.tsx` | modify | Add `onRescan` + `isScanning` props; render Re-scan button with spinner and stale notice |
| `src/webview/index.tsx` | modify | Track `isAdvisoryScanning` + `architectureSummary` state; render maturity badge in tab header; handle new message types |

---

## Signatures and Structures

### A — New types (`src/agentic-detector/types.ts`)

```typescript
// Passed to scan() from extension host, built from in-memory graph data
export interface GraphContext {
  nodeCount: number;
  nodesByType: Record<string, number>;   // e.g. { agent: 3, skill: 5, feature: 28 }
  edgeCount: number;
  featureCount: number;
  featuresByStatus: Record<string, number>; // e.g. { done: 28, in_progress: 0 }
}

// Lightweight summary broadcast to all tabs after every scan
export interface ArchitectureSummary {
  maturityLevel: MaturityLevel;
  maturityLabel: string;
  maturityColor: string;
  activeSuggestions: number;
  scanTimestamp: number;
  isScanning: boolean;
}
```

`AgenticProfile` gains an optional field:
```typescript
export interface AgenticProfile {
  // ... existing fields
  graphContext?: GraphContext;
}
```

### B — `WebviewMessageType` additions (`src/types.ts`)

```typescript
// Add to the union:
| 'rescanAgentic'
```

No payload needed for `rescanAgentic` — it is a fire-and-forget trigger.

`ArchitectureSummary` is sent from extension → webview; it does not need to be in `WebviewMessageType` (that union covers webview → extension messages only). The extension posts it as a raw `{ type: 'architectureSummary', ...summary }` object.

### C — `AgenticDetector.scan()` signature change

```typescript
// Before
async scan(): Promise<AgenticProfile>

// After
async scan(graphContext?: GraphContext): Promise<AgenticProfile>
```

`scan()` stores `graphContext` on the profile before passing it to `generate()`:
```typescript
profile.graphContext = graphContext;
const suggestions = generate(profile, new Set(dismissedIds));
```

A new public method allows coordinators to request debounced scans without owning a timer:
```typescript
scheduleScan(graphContext?: GraphContext, debounceMs = 1000): void {
  if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
  this._debounceTimer = setTimeout(() => {
    this._debounceTimer = null;
    this.scan(graphContext).catch(err => this._log.error(`[AgenticDetector] scheduled scan failed: ${err}`));
  }, debounceMs);
}
```

### D — Advisory engine graph-aware rules (`src/agentic-detector/advisoryEngine.ts`)

Two new rules appended to `RULES[]`:

```typescript
// S-GC01 — agents mapped but no skill documentation
{
  id: 'agents-without-skills',
  condition: (p) => {
    const gc = p.graphContext;
    if (!gc) return false;
    return (gc.nodesByType['agent'] ?? 0) >= 2 && (gc.nodesByType['skill'] ?? 0) === 0;
  },
  build: (p) => {
    const agentCount = p.graphContext?.nodesByType['agent'] ?? 0;
    return {
      title: `${agentCount} agents mapped — document them as skill files`,
      description: `The whiteboard shows ${agentCount} agent nodes but no SKILL.md files exist. Document each agent's capabilities as a skill file to enable reuse and cross-agent composition.`,
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'skills' as const,
      maturityTrigger: ['L2', 'L3', 'L4', 'L5'],
    };
  },
},

// S-GC02 — all features done, nothing active
{
  id: 'sprint-complete',
  condition: (p) => {
    const gc = p.graphContext;
    if (!gc || gc.featureCount === 0) return false;
    return gc.featuresByStatus['in_progress'] === 0
      && (gc.featuresByStatus['pending'] ?? 0) === 0
      && (gc.featuresByStatus['done'] ?? 0) >= 5;
  },
  build: (p) => {
    const doneCount = p.graphContext?.featuresByStatus['done'] ?? 0;
    return {
      title: `Sprint complete — ${doneCount} features done`,
      description: `All tracked features are done and nothing is in progress. Consider starting a new sprint, archiving the backlog, or tagging a release.`,
      impact: 'low' as const,
      effort: 'low' as const,
      layer: 3 as const,
      category: 'methodology' as const,
      maturityTrigger: ['L4', 'L5'],
    };
  },
},
```

### E — Coordinator `scheduleScan` callback

To avoid circular imports (coordinators importing `AgenticDetector`), inject a callback at construction time:

```typescript
// WhiteboardCoordinator constructor
constructor(
  // ... existing params
  private readonly _scheduleScan?: () => void,
) {}

// After any mutating operation:
private _notifyScan(): void {
  this._scheduleScan?.();
}
```

Same pattern for `SddCoordinator`. The callback is set up in `extension.ts`:

```typescript
const scheduleScan = () => agenticDetector.scheduleScan(buildGraphContext());

const whiteboardCoordinator = new WhiteboardCoordinator(
  context, workspaceRoot, log, scheduleScan,
);
const sddCoordinator = new SddCoordinator(
  context, workspaceRoot, log, scheduleScan,
);
```

`buildGraphContext()` reads from the provider's cached `DashboardData`:
```typescript
function buildGraphContext(): GraphContext {
  const data = provider.getCachedData(); // new getter, returns null when not loaded
  if (!data) return { nodeCount: 0, nodesByType: {}, edgeCount: 0, featureCount: 0, featuresByStatus: {} };
  const nodesByType: Record<string, number> = {};
  for (const n of data.graph.nodes) {
    nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
  }
  const featuresByStatus: Record<string, number> = {};
  for (const f of data.features ?? []) {
    featuresByStatus[f.status] = (featuresByStatus[f.status] ?? 0) + 1;
  }
  return {
    nodeCount: data.graph.nodes.length,
    nodesByType,
    edgeCount: data.graph.edges.length,
    featureCount: (data.features ?? []).length,
    featuresByStatus,
  };
}
```

### F — `architectureSummary` broadcast (`extension.ts`)

Scan start:
```typescript
provider.postToWebview({
  type: 'architectureSummary',
  maturityLevel: null,
  maturityLabel: '',
  maturityColor: '',
  activeSuggestions: 0,
  scanTimestamp: Date.now(),
  isScanning: true,
});
await agenticDetector.scan(buildGraphContext());
```

Scan complete (in the `scanComplete` listener):
```typescript
agenticDetector.on('scanComplete', (profile: AgenticProfile) => {
  provider.sendAdvisoryProfile(profile);
  const active = profile.suggestions.filter(
    s => !profile.dismissedSuggestionIds.includes(s.id)
  ).length;
  provider.postToWebview({
    type: 'architectureSummary',
    maturityLevel: profile.maturity.level,
    maturityLabel: profile.maturity.label,
    maturityColor: profile.maturity.color,
    activeSuggestions: active,
    scanTimestamp: profile.scanTimestamp,
    isScanning: false,
  });
});
```

`postToWebview` is a new helper on `HarnessDashboardProvider` that posts to the active view (sidebar or full-window panel).

### G — Maturity badge in tab strip (`src/webview/index.tsx`)

New state:
```typescript
const [architectureSummary, setArchitectureSummary] = React.useState<ArchitectureSummary | null>(null);
const [isAdvisoryScanning, setIsAdvisoryScanning] = React.useState(false);
```

In the message handler:
```typescript
case 'architectureSummary':
  setArchitectureSummary(message);
  setIsAdvisoryScanning(message.isScanning);
  break;
```

Maturity badge rendered in the tab strip header (above the `<Tab>` buttons):
```tsx
{architectureSummary && (
  <MaturityBadge summary={architectureSummary} />
)}
```

`MaturityBadge` is a small new component (~40 lines) in `index.tsx` showing the level pill + label + pulsing dot when `isScanning`.

### H — Re-scan button in `AdvisoryPanel.tsx`

Props additions:
```typescript
interface AdvisoryPanelProps {
  profile: AgenticProfile | null;
  onDismissSuggestion: (id: string) => void;
  onApplyHarnessSDD?: () => void;
  // New:
  onRescan: () => void;
  isScanning: boolean;
}
```

Header update (replacing the timestamp-only span):
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  {isScanning ? (
    <vscode-progress-ring style={{ width: '16px', height: '16px' }} />
  ) : null}
  <span style={{ fontSize: '0.7em', opacity: 0.45 }}>
    {isScanning ? 'Scanning…' : `scanned ${formatTime(profile?.scanTimestamp ?? 0)}`}
  </span>
  <button
    type="button"
    disabled={isScanning}
    onClick={onRescan}
    title="Re-scan architecture"
    style={{ /* compact icon button */ }}
  >
    ↻
  </button>
</div>
```

Stale notice (shown when `profile` exists and is older than 120 s and tab just became active):
```tsx
{isStale && (
  <div style={{ /* amber notice bar */ }}>
    Results may be stale — <button onClick={onRescan}>re-scan now</button>
    <button onClick={() => setIsStale(false)}>×</button>
  </div>
)}
```

`isStale` is local state derived from `profile.scanTimestamp` via a `useEffect` that runs when the panel becomes visible.

### I — Dismissal consolidation (`AdvisoryCoordinator.ts`)

Current (duplicates state):
```typescript
case 'dismissAgenticSuggestion': {
  const current = this._context.workspaceState.get<string[]>('agenticDetector.dismissedSuggestionIds', []);
  if (!current.includes(sugId)) {
    await this._context.workspaceState.update('agenticDetector.dismissedSuggestionIds', [...current, sugId]);
  }
  return true;
}
```

Replacement (single authoritative path):
```typescript
case 'dismissAgenticSuggestion': {
  const sugId = msg.suggestionId;
  if (sugId && typeof sugId === 'string' && this._agenticDetector) {
    await this._agenticDetector.dismissSuggestion(sugId);
    // dismissSuggestion() already calls scan() internally — no extra call needed
  }
  return true;
}
```

---

## Data Flow Summary

```
User clicks Re-scan
  → webview posts { type: 'rescanAgentic' }
  → AdvisoryCoordinator.handle() → agenticDetector.scan(graphContext)
    → extension.ts posts { type: 'architectureSummary', isScanning: true }
  → scan completes → emit 'scanComplete'
    → extension.ts posts { type: 'advisoryProfile', profile }
    → extension.ts posts { type: 'architectureSummary', isScanning: false, maturityLevel: ... }
  → AdvisoryPanel updates (full profile)
  → Maturity badge updates (all tabs)

User creates a node in Whiteboard
  → WhiteboardCoordinator.handle('createNode')
  → calls _scheduleScan() → agenticDetector.scheduleScan(graphContext, 1000)
  → after 1 s quiet period → same scan path as above

User saves a spec in the SDD panel
  → SddCoordinator.handle('saveSpecFile')
  → calls _scheduleScan() → debounce 1 s → scan

User edits a spec file directly in editor
  → FileSystemWatcher on .kiro/specs/** fires
  → AgenticDetector._onFileChanged() → debounce 500 ms → scan
```

---

## Constraints and Invariants

- `GraphContext` is always optional — the scanner and advisory engine MUST work correctly when it is `undefined` (e.g., before the first `DashboardData` is loaded). All graph-aware rules guard with `if (!gc) return false`.
- The `scheduleScan` debounce timer and the file-watcher debounce timer share the same `_debounceTimer` field in `AgenticDetector` — whichever fires first wins, and subsequent triggers within the window are coalesced. The two debounce durations (500 ms file-watcher, 1000 ms coordinator) are intentional: file changes are usually final, coordinator calls may come in bursts.
- `postToWebview` must post to whichever view is currently active (sidebar `WebviewView` or full-window `WebviewPanel`). It is safe to call even when no view is visible — VS Code silently drops the message.
- Phase 1 (R1–R5) is independently shippable. Phase 2 (R6–R15) can follow in a second commit on the same branch.
