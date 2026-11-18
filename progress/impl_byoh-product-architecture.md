# FEAT-039 architecture handoff

Scope of this candidate is the migration architecture. The third column identifies the acceptance work for each implementation wave.

| Requirement | Evidence for design review | Runtime acceptance |
|---|---|---|
| R1, R5 | DESIGN.md §2 and matrix B/C identify graph inputs, source ownership and legacy file defaults. | Foreign-only workspace renders without creating SDD files. |
| R2, R3 | Adapter coverage table and byohInventory.test.ts check the registry IDs, column names and vocabulary. | Each adapter declares its operations using the contract. |
| R4, R8, R10 | Adapter action contract specifies the host and UI checks, zero coverage and partial operations. | Attempt unsupported actions from both UI and host messages. |
| R6 | DESIGN.md and profile v1 define filesystem and execution boundaries. | Compare workspace files and hook invocations before and after scans. |
| R7 | Profile v1 mapping example and companion extension v1 registration/disposal contract. | Load a Markdown profile and register, rescan and dispose an extension adapter. |
| R9 | Mixed workspace provenance and rescan acceptance in adapter-capabilities.md. | Verify same-named entities from two sources remain attributable. |
| R11 | Feature matrix and byohInventory.test.ts enforce one decision per ID in feature_list.json. | Runs automatically in npm test and CI. |
| R12 | Matrix A–D and successor FEAT-040 demonstrate the spec revision path. | Review each affected spec before its runtime change. |
| R13 | Adapter table records source-based baseline and limitations. | Compare built-in results before and after migration. |
| R14 | FEAT-040 requirements, design and tasks supersede the FEAT-027 product behavior upon approval. | Run contributor fixtures, inspect the package, and verify save isolation in the host. |
| R15 | Real-workspace smoke procedure lists seven workspace sources, expected files, steps and evidence fields. | Seven observed results remain open in the P1 backlog. |

Local candidate checks: build passed, 821 Vitest tests passed, VSIX gates passed at 373,009 bytes, and check.sh passed 35 checks. The host migration scenarios above are acceptance criteria for subsequent implementation.
