# Requirements — Code Quality On-Save Hooks (KISS + DRY)

> Feature FEAT-027. When the user saves a TypeScript/TSX file in the project,
> two hooks run — one for KISS (anti-overengineering) and one for DRY
> (anti-duplication). Both hooks derive their rules from the steering files
> `steering/kiss-principle.md` and `steering/dry-principle.md`, so adding a new
> principle to those steerings is enough to extend the checks.
>
> Each requirement is written in strict EARS and is verifiable by at least one
> specific test.

## EARS Patterns

| Pattern     | Syntax                              | When to use                              |
|-------------|-------------------------------------|------------------------------------------|
| Ubiquitous  | `SHALL ...`                         | Always true, permanent condition         |
| Event       | `WHEN <event> SHALL ...`            | Triggered by a specific event            |
| State       | `WHILE <state> SHALL ...`           | While a condition remains true           |
| Optional    | `WHERE <option> SHALL ...`          | Behavior varies based on configuration   |
| Unwanted    | `IF <condition> THEN SHALL ...`     | Response to failures or edge cases       |

## Requirements

### Triggering

### R1 — Save event for TypeScript files
- **Pattern:** Event
- WHEN the user saves any file matching `**/*.ts` or `**/*.tsx` inside `<workspace-root>/src/` AND the global setting `harness-dashboard.codeQuality.verifyOnSave` is `true` (default), the extension SHALL run the KISS hook and the DRY hook with the saved file's path.

### R2 — Manual invocation
- **Pattern:** Event
- WHEN the user invokes the command `Harness Dashboard: Verify Code Quality`, the extension SHALL prompt for a file and SHALL run both hooks on it. This is the fallback for users who want to re-run checks without re-saving.

### KISS hook behaviour (anti-overengineering)

### R3 — Long files
- **Pattern:** Unwanted
- IF a saved file exceeds 400 lines, THEN the KISS hook SHALL warn ("File is large; consider splitting").

### R4 — Long functions
- **Pattern:** Unwanted
- IF a saved file contains a function (TS function, arrow assigned to `const`, or class method) whose body exceeds 80 lines, THEN the KISS hook SHALL warn with the function's name and line range.

### R5 — Deep nesting
- **Pattern:** Unwanted
- IF any function in a saved file has more than 4 levels of indentation (counted by leading whitespace on the deepest line in the body), THEN the KISS hook SHALL warn ("Deep nesting; consider early-return or extraction").

### R6 — Unused parameters
- **Pattern:** Unwanted
- IF a function declares a parameter that is not referenced inside the function body AND its name does not start with `_`, THEN the KISS hook SHALL warn.

### R7 — Overly defensive code
- **Pattern:** Unwanted
- IF a saved file contains three or more `try { ... } catch (e) { /* swallow */ }` blocks where the catch body is empty or only rethrows, THEN the KISS hook SHALL warn ("Excessive swallowed exceptions; consider letting them propagate").

### DRY hook behaviour (anti-duplication)

### R8 — Repeated literal strings
- **Pattern:** Unwanted
- IF the same string literal of length ≥ 12 characters appears 3 or more times in a saved file, THEN the DRY hook SHALL warn with the literal and the line numbers.

### R9 — Repeated numeric literals (sentinel)
- **Pattern:** Unwanted
- IF a magic number other than `0`, `1`, `-1`, `2` appears 3 or more times in a saved file, THEN the DRY hook SHALL warn ("Repeated magic number; extract a named constant").

### R10 — Copy-paste functions
- **Pattern:** Unwanted
- IF two function bodies in a saved file share a normalised-token Jaccard similarity of 0.85 or higher AND are at least 30 tokens long, THEN the DRY hook SHALL warn that the two functions are likely duplicates and should be extracted.

### R11 — Duplicated type/interface definitions
- **Pattern:** Unwanted
- IF the same TypeScript `interface` or `type` literal is defined twice in the saved file (same name, same shape modulo whitespace), THEN the DRY hook SHALL warn.

### Reporting

### R12 — Output shown in VS Code
- **Pattern:** Ubiquitous
- The hooks SHALL surface their results as `Diagnostic` entries in VS Code's Problems panel AND as a multi-line report in the OutputChannel "Harness Dashboard". Each diagnostic has a severity (Warning or Error) and a source identifier (`harness-kiss` or `harness-dry`).

### R13 — Non-blocking by default
- **Pattern:** Optional
- WHERE the user has set `harness-dashboard.codeQuality.blockOnSave` to `false` (default), the hooks SHALL NOT prevent the save. WHERE it is `true`, the hooks SHALL cancel the save IF any `Error`-severity issue was reported.

### R14 — Severity classification
- **Pattern:** Ubiquitous
- The hooks SHALL classify issues as:
  - **Error**: malformed TypeScript (parse failure).
  - **Warning**: every check listed in R3–R11 (all warnings by default; the user can promote them to errors via `harness-dashboard.codeQuality.severity`).

### R15 — Severity override
- **Pattern:** Optional
- WHERE the user has set `harness-dashboard.codeQuality.severity` to `"warning"` (default) or `"error"`, the hooks SHALL use that severity for all issues they report. The setting `"error"` promotes all warnings to errors.

### Configuration and integration

### R16 — Per-hook enable
- **Pattern:** Optional
- WHERE the user has set `harness-dashboard.codeQuality.kissEnabled` to `false`, the extension SHALL NOT run the KISS hook. The same pattern applies to `harness-dashboard.codeQuality.dryEnabled`.

### R17 — Hooks are registered in `agentic.json`
- **Pattern:** Ubiquitous
- Both hooks SHALL be discoverable through the existing `agentic.json#hooks[]` mechanism, with events `on_file_saved_kiss` and `on_file_saved_dry`. The `hooks/run-hooks.sh` runner SHALL be able to invoke them (so CI can also run them).

### R18 — Hook scripts are derivable from the steering files
- **Pattern:** Ubiquitous
- The check catalog in `hooks/code-quality-checks.json` SHALL be the machine-readable form of the rules listed in `steering/kiss-principle.md` and `steering/dry-principle.md`. WHEN the steering file is updated, a developer can manually re-derive the catalog; the catalog is the single source of truth at runtime. This makes the link between the two steerings and the two hooks explicit and auditable.

## Traceability with Acceptance Criteria

| Acceptance Criterion                                                | Covered by          |
|---------------------------------------------------------------------|---------------------|
| Saving a TypeScript file runs the two hooks                         | R1                  |
| Manual command runs the two hooks on a chosen file                  | R2                  |
| Files > 400 lines warn                                              | R3                  |
| Functions > 80 lines warn                                           | R4                  |
| Nesting > 4 levels warns                                            | R5                  |
| Unused (non-`_`-prefixed) parameters warn                            | R6                  |
| 3+ swallowed exceptions warn                                        | R7                  |
| Same string literal (≥ 12 chars) appears 3+ times → warn            | R8                  |
| Magic numbers 3+ times → warn                                       | R9                  |
| Two functions with Jaccard ≥ 0.85 → warn                            | R10                 |
| Duplicate `interface`/`type` definitions → warn                     | R11                 |
| Issues appear in Problems panel and OutputChannel                   | R12                 |
| Save not blocked by default                                         | R13                 |
| Issues classified as Error or Warning                               | R14                 |
| User can promote warnings to errors                                 | R15                 |
| Each hook can be enabled/disabled independently                     | R16                 |
| Hooks integrate with existing `agentic.json#hooks[]` mechanism      | R17                 |
| Check catalog is the runtime form of the steering principles        | R18                 |
