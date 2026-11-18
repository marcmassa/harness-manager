# FEAT-027 revision for review

**Decision requested.** Scope the nine KISS/DRY checks to development of Harness Dashboard. This addendum proposes a replacement for the installed extension's save behavior. It preserves the historical approved spec and its evidence. Apply the revision after human approval.

| Existing requirements | Revised acceptance and verification |
|---|---|
| R1, R2, R12, R13, R15, R16, R19 (working branch) | Installing the extension and saving a TS/TSX file in a foreign workspace must never launch these checks, emit their diagnostics or prompt the user. Run a real Extension Host save with sentinel scripts in the workspace and both existing setting names enabled. Assert the scripts never run and the edited text reaches disk. |
| R3–R11, R14, R17, R18 | Contributors can still invoke the repository hooks on an explicit source file. Exercise all nine rule IDs on known fixtures, verify the catalog and both manifest registrations, and run on a clean fixture. Preserve rule definitions during this migration. |

Implementation order after approval: establish the contributor command and fixtures, remove verifier registration, extension commands and settings from the shipped manifest, document retirement of both legacy setting names, then inspect the packaged VSIX and run the host regression. The in-progress save-warning branch is useful evidence for compatibility cases. Its save listener is superseded by this proposal. Users may still view their own hooks through any capable adapter.

## Affected surfaces

The candidate revises src/extension.ts, src/verifier, package.json, repository hook tests and contributor documentation. Check feature_list.json and legacy settings in the maintenance branch when reconciling changes. A per-adapter opt-in save listener was considered. It would still bundle and maintain a developer-specific lint policy inside the product. Existing workspaces may keep retired settings in settings.json. Avoid rewriting those files during upgrade.
