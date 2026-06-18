# Design — Code Quality On-Save Hooks (KISS + DRY)

> Feature FEAT-027. Two bash hooks that verify KISS and DRY principles on every
> TypeScript save. Both hooks read from a single JSON catalog that mirrors the
> rules in the corresponding steering files.

## 1. Architecture

```
┌─────────────────────────────────────────────────┐
│  extension.ts (registers a save listener)        │
│  ─────────────────────────────────────────────   │
│   onWillSaveTextDocument → if *.ts/tsx, queue   │
│   onDidSaveTextDocument  → run both hooks        │
└────────────────┬────────────────────────────────┘
                 │  (in parallel)
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│ on-file-saved-   │  │ on-file-saved-   │
│ kiss-check.sh    │  │ dry-check.sh     │
│ (bash + python3) │  │ (bash + python3) │
└────────┬─────────┘  └────────┬─────────┘
         ▼                     ▼
        JSON report each (stdout)
         │                     │
         └─────────┬───────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│  src/verifier/codeQualityRunner.ts              │
│  ─────────────────────────────────────────────   │
│  Merges the two reports → Diagnostics[]          │
│  Writes to DiagnosticCollection + OutputChannel  │
└─────────────────────────────────────────────────┘
```

Two parallel scripts, one shared catalog. Both report in the same JSON shape so the TS consumer treats them uniformly.

## 2. The check catalog: `hooks/code-quality-checks.json`

A single JSON file that lists every check, with its KISS/DRY tag, the steering section it derives from, and a short description. The catalog is the runtime form of the steering principles.

```json
{
    "version": 1,
    "kiss": {
        "rules": [
            {"id": "kiss-long-file",     "severity": "warning", "description": "File > 400 lines"},
            {"id": "kiss-long-function", "severity": "warning", "description": "Function > 80 lines"},
            {"id": "kiss-deep-nesting",  "severity": "warning", "description": "Nesting > 4 levels"},
            {"id": "kiss-unused-param",  "severity": "warning", "description": "Unused (non-_) parameter"},
            {"id": "kiss-swallow-error", "severity": "warning", "description": "3+ swallowed exceptions"}
        ]
    },
    "dry": {
        "rules": [
            {"id": "dry-repeated-string",  "severity": "warning", "description": "Same literal (≥12 chars) 3+ times"},
            {"id": "dry-magic-number",     "severity": "warning", "description": "Magic number 3+ times"},
            {"id": "dry-duplicate-function", "severity": "warning", "description": "Functions with Jaccard ≥ 0.85"},
            {"id": "dry-duplicate-type",   "severity": "warning", "description": "Duplicate interface/type"}
        ]
    }
}
```

This catalog is hand-written and cross-references the steering files in its `description` field. **R18 says the catalog is the single source of truth at runtime** — the steerings document the *why*, the catalog implements the *what*. They MUST stay in sync; the spec lists this as a manual review responsibility.

## 3. The two hook scripts

Both follow the same pattern as the other hooks in this repo: bash entry point + python3 implementation. They exit 0 always (issues do not fail the run; they're surfaced in the report).

```bash
#!/bin/bash
# on-file-saved-kiss-check.sh
set -uo pipefail
FILE="${FILE:-}"
[ -z "$FILE" ] && { echo "ERROR: FILE env var required" >&2; exit 64; }
[ -f "$FILE" ] || { echo "ERROR: file not found: $FILE" >&2; exit 66; }
python3 "$(dirname "$0")/kiss_check.py" "$FILE"
```

The python implementation is straightforward regex/AST walking:

| Check (R) | Implementation |
|-----------|----------------|
| R3 long file | `wc -l < "$FILE"` > 400 |
| R4 long function | AST walk with `esprima` or simple `function ... {` regex; count braces |
| R5 deep nesting | AST walk; track max indent in function bodies |
| R6 unused param | Regex for function parameters; cross-check against body |
| R7 swallow error | `re.findall(r'try\s*\{', body)`, `re.findall(r'catch\s*\([^)]*\)\s*\{\s*\}', body)` count |
| R8 repeated string | tokenise string literals (≥ 12 chars), count occurrences |
| R9 magic number | tokenise numeric literals, count occurrences excluding `{0, 1, -1, 2}` |
| R10 duplicate function | tokenise function bodies, compute Jaccard, compare pairs |
| R11 duplicate type | parse `interface`/`type` blocks, compare by normalised shape |

We use **esprima** for the AST (already a dev dep in some VS Code extensions; otherwise install ad-hoc). The implementation lives in `hooks/kiss_check.py` and `hooks/dry_check.py` respectively, ~100 lines each.

## 4. The report format

Each script writes a single JSON object to stdout:

```json
{
    "hook": "harness-kiss" | "harness-dry",
    "file": "<relative path>",
    "issues": [
        {"id": "kiss-long-function", "severity": "warning", "line": 42, "message": "Function 'parseFoo' is 95 lines (limit 80)"},
        ...
    ]
}
```

Exit code is always 0 unless the file is missing (R12 + R14).

## 5. The TypeScript module: `src/verifier/codeQualityRunner.ts`

```typescript
export interface CodeQualityIssue {
    id: string;
    severity: 'error' | 'warning';
    line: number;
    message: string;
}

export interface HookReport {
    hook: 'harness-kiss' | 'harness-dry';
    file: string;
    issues: CodeQualityIssue[];
}

export async function runCodeQualityHooks(
    filePath: string,
    root: vscode.Uri,
    options: { kissEnabled: boolean; dryEnabled: boolean; severity: 'warning' | 'error' },
): Promise<HookReport[]>;
```

The function spawns the two scripts in parallel (`Promise.all`), parses their JSON outputs, and returns the merged list. The caller (extension.ts) converts each issue to a `Diagnostic` and pushes to a `DiagnosticCollection` keyed by file URI.

## 6. Save listener registration

Same pattern as the proposed FEAT-027: `onWillSaveTextDocument` (to block if `blockOnSave`) and `onDidSaveTextDocument` (to surface issues).

```typescript
const onWillSave = vscode.workspace.onWillSaveTextDocument(async (event) => {
    if (!shouldVerify(event.document.uri)) return;
    if (!blockOnSave) return;
    const reports = await runCodeQualityHooks(...);
    if (reports.some(r => r.issues.some(i => i.severity === 'error'))) {
        event.waitUntil(Promise.resolve([]));   // cancel save
    }
});

const onDidSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (!shouldVerify(doc.uri)) return;
    const reports = await runCodeQualityHooks(...);
    updateDiagnostics(doc.uri, reports);
    logChannel.appendLine(formatReports(doc.uri, reports));
});
```

`shouldVerify` checks: extension is `.ts` or `.tsx` AND path starts with `<workspace>/src/` AND setting is on.

## 7. Configuration

Four settings in `package.json#contributes.configuration`:

```jsonc
"harness-dashboard.codeQuality.verifyOnSave": { "type": "boolean", "default": true },
"harness-dashboard.codeQuality.blockOnSave":  { "type": "boolean", "default": false },
"harness-dashboard.codeQuality.kissEnabled":  { "type": "boolean", "default": true },
"harness-dashboard.codeQuality.dryEnabled":   { "type": "boolean", "default": true },
"harness-dashboard.codeQuality.severity":     { "type": "string", "enum": ["warning", "error"], "default": "warning" }
```

## 8. Hook registration in `agentic.json`

```json
{
    "event": "on_file_saved_kiss",
    "script": "hooks/on-file-saved-kiss-check.sh",
    "description": "KISS checks (anti-overengineering) on every saved TS/TSX file",
    "on_failure": "ignore"
},
{
    "event": "on_file_saved_dry",
    "script": "hooks/on-file-saved-dry-check.sh",
    "description": "DRY checks (anti-duplication) on every saved TS/TSX file",
    "on_failure": "ignore"
}
```

`on_failure: "ignore"` because the hook's job is to *report*, not to fail the run.

## 9. Manual command

`Harness Dashboard: Verify Code Quality` — opens a file picker filtered to `src/**/*.ts(x)`, runs both hooks on the chosen file, shows the merged report in the OutputChannel.

## 10. Discarded alternatives

### 10.1 One unified hook instead of two
**Discarded** because KISS and DRY are independent principles; users may want to disable one (R16). Two scripts share the catalog but report independently.

### 10.2 Verifier as a TypeScript module
**Discarded** because the existing hooks in this repo are bash, and the catalog + python3 are the simplest implementation. CI use (`hooks/run-hooks.sh on_file_saved_kiss --file ...`) works without Node.

### 10.3 Use ESLint or Biome rules
**Discarded** because the catalog is project-specific and derived from the steering files. Wiring ESLint would be a much larger surface (config, plugins, parsers) for the same outcome. The two scripts implement exactly the 9 checks listed in the requirements — no more.

### 10.4 AST-based implementation in TypeScript
**Discarded** for the same reason as 10.2 — would require bundling esprima/swc in the webview, complicating the build. Python's `ast` module is enough.

## 11. Compatibility

- No existing behaviour changes. The new hooks are additive.
- The two new settings default to non-intrusive values.
- The `code-quality-checks.json` is a new file; no migration.
- Existing tests are unaffected.
