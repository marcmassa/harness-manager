# FEAT-040 — Repository quality hooks (revision of FEAT-027)

### R1 — Contributor checks
When a contributor invokes a registered KISS or DRY event with a TypeScript source path, the repository runner SHALL emit that hook's JSON report.

### R2 — Coverage of development rules
The contributor checks SHALL cover the five KISS and four DRY rule IDs in the existing repository catalog.

### R3 — Save isolation
When a user saves a document, the installed extension SHALL leave execution of the repository's KISS and DRY hooks to the workspace's own tooling, including when legacy Dashboard settings are present.

### R4 — Public surface
The packaged extension SHALL omit the FEAT-027 verifier command, settings and diagnostics producer.

### R5 — Hook discovery
Where a harness declares KISS or DRY hook resources, read-only Dashboard discovery SHALL preserve their source attribution.
