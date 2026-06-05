---
name: ears-requirements
description: "How to write requirements in EARS (Easy Approach to Requirements Syntax) notation. Use when the user asks to write requirements, R1/R2, SHALL, EARS, ubiquitous/event/state/optional/unwanted patterns, or wants to verify that requirements are testable. Triggers on keywords: EARS, requirements, R1, SHALL, SHALL NOT, ubiquitous, event-driven, state-driven, optional, unwanted."
---

# EARS — Easy Approach to Requirements Syntax

EARS is a notation for writing requirements so they are **unambiguous**, **verifiable**,
and **one-idea-per-line**. The Harness SDD framework requires EARS for every
`specs/<feature>/requirements.md`.

## The five patterns

| Pattern | Syntax | When | Example |
|---|---|---|---|
| **Ubiquitous** | `SHALL <action>` | The condition is always true | `The system SHALL use AES-256 encryption` |
| **Event** | `WHEN <event> SHALL <action>` | Triggered by a specific event | `WHEN the user clicks submit SHALL save data` |
| **State** | `WHILE <state> SHALL <action>` | While a continuous state holds | `WHILE in maintenance mode SHALL return 503` |
| **Optional** | `WHERE <option> SHALL <action>` | Varies by configuration | `WHERE region is EU SHALL comply with GDPR` |
| **Unwanted** | `IF <condition> THEN SHALL <action>` | Response to failures or edge cases | `IF connection fails THEN SHALL retry 3 times` |

## Hard rules

1. **Each requirement has a unique, stable ID**: `R1`, `R2`, ...
2. **Each requirement is verifiable by at least one test.**
3. **One requirement = one `SHALL`.** Do not combine multiple `SHALL`s in one sentence.
4. **Only `SHALL` / `SHALL NOT`.** Never use `should`, `could`, `may`, `can`, `supports`.
5. **Order matters**: `R1` before `R2` if there is a logical dependency.
6. **No negative requirements without a positive counterpart.** If you write `R5: SHALL NOT log PII`, also write `R6: WHEN a PII field is detected SHALL redact it before logging`.

## Good vs bad examples

### Bad (verifiability failure)

> `R1: The system SHALL be fast`

What does "fast" mean? < 1s? < 100ms? Under what load? Reject.

### Good

> `R1: WHEN the API receives a GET /v1/users request under a load of 1000 RPS, the API SHALL return a response within 200ms at the 95th percentile.`

### Bad (multiple SHALLs)

> `R1: The system SHALL encrypt data at rest and SHALL rotate keys every 90 days and SHALL log rotations.`

Split into R1, R2, R3.

### Good

> `R1: The system SHALL encrypt all data at rest using AES-256.`
> `R2: The system SHALL rotate encryption keys every 90 days.`
> `R3: WHEN a key rotation occurs the system SHALL log the rotation with timestamp and key ID.`

### Bad (soft verbs)

> `R1: The system should support SAML and OIDC.`

`should` is forbidden. Use `SHALL`.

### Good

> `R1: WHERE the auth_provider configuration is "saml" the system SHALL authenticate users via SAML 2.0.`
> `R2: WHERE the auth_provider configuration is "oidc" the system SHALL authenticate users via OpenID Connect.`

### Bad (untestable)

> `R1: The system SHALL be user-friendly.`

Replace with measurable criteria.

### Good

> `R1: WHEN a new user opens the dashboard for the first time SHALL display the onboarding wizard.`
> `R2: WHEN the user clicks "Skip" SHALL dismiss the wizard and SHALL not display it again in the same session.`

## Combining patterns

A requirement can use a single pattern. Do not mix two patterns in the same
sentence; create two requirements instead.

```text
WHILE in maintenance mode, WHEN an admin calls /health, SHALL return 503 with a JSON body.
```

Split:

- `R1: WHILE in maintenance mode the system SHALL return 503 for all /health calls.`
- `R2: WHILE in maintenance mode the system SHALL include a JSON body with field "reason" set to "maintenance".`

## The acceptance-criteria table

After listing requirements, add a traceability table at the end:

```markdown
## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| Encrypted at rest     | R1, R2 |
| 90-day key rotation   | R3 |
```

This makes the link between user-visible behavior and requirement IDs explicit.

## Common pitfalls

- **Tautologies**: `R1: The system SHALL work.` — reject.
- **Implementation leakage**: `R1: The system SHALL use PostgreSQL 15.` — typically belongs in `design.md`, not requirements. Requirements describe behavior, design describes how.
- **Hidden conditions**: `R1: WHEN a user logs in SHALL...` without specifying "valid credentials". State the precondition.
- **Missing SHALL NOT**: if a behavior is forbidden, write a `SHALL NOT` requirement, not just an absent one.

## Related

- `harness-sdd` — the broader workflow this notation is part of.
- `docs/sdd.md` — full SDD documentation in the project.
