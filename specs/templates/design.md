# Design — {Feature Name}

> Technical decisions to implement feature {id}. Based on the project's sources of truth (AGENTS.md, docs/). Only points where the feature touches the boundaries of those rules are documented.

## Summary

{1-2 paragraphs explaining what this functionality does and why it is necessary}

## Affected Files

| File | Action | Reason |
|---------|--------|-------|
| `src/module/handler.{ext}` | create | {reason} |
| `src/module/service.{ext}` | create | {reason} |
| `tests/module/test_service.{ext}` | create | {reason} |
| `config/example.yaml` | modify | {reason} |

## Signatures and Structures

*[Specify function signatures, classes, interfaces, or API contracts according to the project language and layer]*

```
# Example: HTTP endpoint contract
POST /resource
Request:  { field1: string, field2: int }
Response: { id: uuid, created_at: iso8601 }
```

```
# Example: service function signature (language-agnostic pseudo-code)
function do_thing(input: InputType) -> Result | Error
  1. validate input
  2. call dependency
  3. return result
```

## Algorithm / Flow

```
1. {step 1 — input validation}
2. {step 2 — main resource creation}
3. {step 3 — dependency configuration}
4. {step 4 — verification and outputs}
```

## Error Handling

| Condition | Response |
|-----------|-----------|
| {error case 1} | {expected behavior} |
| {error case 2} | {expected behavior} |

## Discarded Alternative

{Explain what other approach was considered and why it was discarded. At least one alternative is required.}

## Risks and Edge Cases

- {risk 1 — impact and mitigation}
- {risk 2 — impact and mitigation}
- {edge case 1 — expected behavior}
