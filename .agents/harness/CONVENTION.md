# Harness SDD — Usage Convention

## Purpose

Establish the guideline so that any agent (AI or human) working in this repository
uses the harness consistently.

## Mandatory Rules

1. **Classify the task first.** Use `ROUTING.md` to determine which agent(s) to use.
2. **Harness First.** The Harness SDD is the single operating framework. Parallel workflows that do not respect the traceability of `feature_list.json` and `progress/` are not allowed.
3. **Skills Registry.** This template is agnostic. Technical knowledge lives in the [Agent Skills Registry](https://gitlab.devops.onesait.com/onesait/technology/devops/infrastructure/agent-skills-registry.git). It is mandatory to sync skills before starting technical tasks.
4. **Steering and Hooks.** Use `steering/` files to customize agent behavior per role. Use `hooks/` scripts to inject automation at SDD lifecycle points (`on_spec_created`, `on_feature_done`, etc.). Declare both in `agentic.json`.
5. **Read the context, cheaply.** Follow `AGENTS.md` and run `./.agents/bootstrap.sh brief` before starting; it replaces reading `feature_list.json` and `progress/` in full. Check `.agents/skills/` for any relevant skills.
6. **One feature at a time.** `check.sh` will reject more than one `in_progress`.
7. **Do not skip the spec.** If `sdd: true`, go through spec_author → human → implementation.
8. **`check.sh` is the gateway.** Do not declare `done` unless it passes clean.
9. **Document on disk.** Keep `progress/current.md` as the live state only (replace, do not append). On close, a short summary in `progress/progress.md`.

## Recommended Flow

```
1. ./check.sh --quiet                    # Verify the environment is ready
2. ./.agents/bootstrap.sh brief           # Active feature, next task, session state
3. Load only what the task needs         # See AGENTS.md §2
4. Read specs/<feature>/ (if applicable)  # Approved spec
5. Execute tasks.md                       # Sequential implementation
6. ./check.sh                              # Final verification
7. workflow-transition --target done     # Validated status change
8. Record in progress/progress.md         # Closure
```

## Recommendation Checklist

Before executing complex tasks:

- [ ] Have I classified the task using `ROUTING.md`?
- [ ] Have I run `./.agents/bootstrap.sh brief` to understand the state?
- [ ] Have I verified that no other feature is `in_progress`?
- [ ] Have I checked steering and hooks for this task?
- [ ] Will I run `./check.sh` before declaring `done`?
