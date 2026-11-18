# Tasks — BYOH product architecture

> This spec defines the migration plan and architecture boundary. Runtime changes to affected features require their own approved specs.

## Product Inventory

- [x] **T1** — Audit every current feature and classify it as shared-core, adapter-specific, optional integration, or repository-development tooling in `docs/byoh/feature-compatibility-matrix.md`. _(R11, R12)_
- [x] **T2** — Map each built-in adapter's existing behavior and dependencies to product capabilities. _(R2, R3, R4, R9, R13, R15)_
- [x] **T3** — Identify Harness SDD assumptions in current user-facing features and list each required follow-up spec revision. _(R1, R4, R8, R12)_

## Architecture

- [x] **T4** — Document the `supported` / `partial` / `unsupported` capability vocabulary and adapter ownership boundaries in `docs/byoh/adapter-capabilities.md`. _(R2, R3, R4, R8, R10)_
- [x] **T5** — Update `DESIGN.md` with the BYOH product principle, source-of-truth rule, read-only discovery boundary, and adapter-specific capability rule. _(R1, R5, R6, R7, R8, R9, R10)_
- [x] **T6** — Specify the declarative workspace profile and versioned custom-adapter extension API without implementing runtime behavior. _(R7, R10, R13)_
- [x] **T7** — Revise FEAT-027 so KISS/DRY hooks are repository development tooling and are not part of the installed extension's behavior. _(R14)_

## Migration Plan

- [x] **T8** — Create a prioritized follow-up spec list for every feature identified in T3; each code change waits for human approval of its revised spec. _(R4, R8, R12, R13)_
- [x] **T9** — Define repeatable real-workspace smoke validation for all seven advertised adapters and include representative fixture sources. _(R3, R13, R15)_
- [x] **T10** — Document risks, compatibility boundaries, and what will remain adapter-specific versus shared in the migration matrix. _(R1, R5, R8, R9, R10, R11)_

## Tests and Closure

- [x] **T11** — Add a consistency check that every existing feature has exactly one classification and every adapter capability is documented. _(R2, R3, R10, R11)_
- [x] **T12** — Document the `R<n> ↔ artifact/check` map in `progress/impl_byoh-product-architecture.md`. _(R1–R15)_
- [x] **T13** — Run `./check.sh` and verify the architecture, inventory, and migration artifacts pass repository governance. _(R1–R15)_
