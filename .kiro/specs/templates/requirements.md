# Requirements — {Feature Name}

> Feature {id} from `feature_list.json`. {Brief description of the functionality and its context}
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — {short title}
- **Pattern:** {Ubiquitous / Event / State / Optional / Unwanted}
- {EARS requirement wording}

### R2 — {short title}
- **Pattern:** {pattern}
- {EARS wording}

### R3 — {short title}
- **Pattern:** {pattern}
- {EARS wording}

### R4 — {short title}
- **Pattern:** {pattern}
- {EARS wording}

### R5 — {short title}
- **Pattern:** {pattern}
- {EARS wording}

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| {Criterion 1} | R1, R3 |
| {Criterion 2} | R2 |
| {Criterion 3} | R4, R5 |
