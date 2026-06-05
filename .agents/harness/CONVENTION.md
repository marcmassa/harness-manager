# Harness SDD — Usage Convention

## Purpose

Establish the guideline so that any agent (AI or human) working in this repository
uses the harness consistently.

## Mandatory Rules

1. **Classify the task first.** Use `ROUTING.md` to determine which agent(s) to use.
2. **Harness First.** The Harness SDD is the single operating framework. Parallel workflows that do not respect the traceability of `feature_list.json` and `progress/` are not allowed.
3. **Skills Registry.** This template is agnostic. Technical knowledge lives in the [Agent Skills Registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git). It is mandatory to sync skills before starting technical tasks.
4. **Read the context.** Always read `AGENTS.md`, `feature_list.json` and `progress/current.md` before starting. Check `.agents/skills/` for any relevant skills.
5. **One feature at a time.** `check.sh` will reject more than one `in_progress`.
6. **Do not skip the spec.** If `sdd: true`, go through spec_author → human → implementation.
7. **`check.sh` is the gateway.** Do not declare `done` unless it passes clean.
8. **Document on disk.** Every advance in `progress/current.md`. On close, summary in `progress/progress.md`.

## Recommended Flow

```
1. ./check.sh                            # Verify the environment is ready
2. Read feature_list.json                 # Identify the next feature
3. Read progress/current.md               # Session context
4. Read specs/<feature>/ (if applicable)  # Approved spec
5. Execute tasks.md                       # Sequential implementation
6. ./check.sh                              # Final verification
7. Update feature_list.json               # Mark done
8. Record in progress/progress.md         # Closure
```

## Recommendation Checklist

Before executing complex tasks:

- [ ] Have I classified the task using `ROUTING.md`?
- [ ] Have I read `feature_list.json` to understand the state?
- [ ] Have I checked `progress/current.md` for context?
- [ ] Have I verified that no other feature is `in_progress`?
- [ ] Will I run `./check.sh` before declaring `done`?
