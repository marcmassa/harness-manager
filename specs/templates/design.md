# Design — {Feature Name}

> Technical decisions to implement feature {id}. Based on the project's sources of truth (AGENTS.md, docs/). Only points where the feature touches the boundaries of those rules are documented.

## Summary

{1-2 paragraphs explaining what this functionality does and why it is necessary}

## Affected Files

| File | Action | Reason |
|---------|--------|-------|
| `path/to/file.tf` | create | {reason} |
| `path/to/file_test.go` | create | {reason} |
| `path/to/file.py` | modify | {reason} |

## Signatures and Structures

### Infrastructure / Configuration
```hcl
module "example" {
  source = "./modules/example"
  # inputs
  name        = string
  environment = optional(string, "dev")
  tags        = optional(map(string), {})
}
```

### Programming Languages (Python / Go / TS / etc.)
*[Specify function signatures, classes, or interfaces according to the project language]*

```python
# module.function — description
def function(param: str) -> dict: ...
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
