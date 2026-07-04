---
title: Autonomous Design
description: Design flows that run unattended — when to delegate, how to isolate, and composing gates with delegation
---

## Two Execution Paths

Every role has two possible execution paths:

| Path | Mechanism | Behavior | Best for |
|------|-----------|----------|----------|
| VS Code LM API | Default | Interactive, shows output in chat, user watches | Quick flows, real-time feedback, human gates |
| Delegation | `delegate: true` | Background, runs unattended, notification on completion | Long-running flows, batch processing, autonomous work |

```yaml
roles:
  - name: "Interactive Role"
    prompt: Review this code...
    # no delegate — runs in chat, you see output live

  - name: "Autonomous Role"
    prompt: Write comprehensive tests...
    delegate: true    # runs in background, you get notified when done
```

## When to Delegate

Delegate when the flow takes more than 2-3 minutes or you want to keep working while it runs.

| Task | Duration | Delegate? |
|------|----------|-----------|
| Code review | 30-60 sec | No — watch it |
| Write tests for 1 file | 1-2 min | Optional |
| Estimate 12 backlog items | 5-10 min | Yes |
| Full SDD cycle (spec → code → tests) | 10-20 min | Yes |
| Multi-file refactoring | 5-15 min | Yes |

**Rule of thumb:** If you'd switch tabs and do something else, delegate.

## Worktree Isolation

When `delegate: true` is combined with `isolation: worktree`, the delegated role runs in a separate Git worktree:

```yaml
groups:
  - name: "Feature Team"
    isolation: worktree      # isolated workspace
    roles:
      - name: "Developer"
        delegate: true        # autonomous + isolated = safe
```

**Why isolate?**
- File changes don't affect your working directory
- Multiple autonomous roles can run simultaneously without conflicts
- You can review changes before merging them

**Real example:** `cli-autonomous-worktree.flow.yaml` — Feature Team and Test Team each get isolated worktrees so they can create files independently without conflicts.

## The Gate-Delegation Tension

Human gates (`vscode_askQuestions`) and delegation are incompatible:

```
vscode_askQuestions: "Pause and ask the user a question"
delegate: true:       "Run in the background with no user"

These can't both be true for the same role.
```

**The solution: compose them.** Gate first (interactive), then delegate (background):

```yaml
roles:
  - name: "Commander"
    prompt: |
      Call vscode_askQuestions to gather requirements...
    # NO delegate — user answers questions

  - name: "Executor"
    prompt: |
      Execute based on the Commander's directive...
    delegate: true        # runs in background after gate completes
```

**Real example:** `sdd-openspec-full-cycle.flow.yaml` — the Requirements Clarifier runs interactively (human gate), then the remaining stages can be delegated for autonomous background execution.

## Designing for Autonomy

A flow designed for autonomy needs:

1. **Clear input** — either from a human gate or a very specific user query. Autonomous roles can't ask for clarification.

2. **Self-contained output** — the role should produce a complete, usable result. No "let me know if you want me to continue."

3. **Error handling in prompts** — autonomous roles should know what to do when tools fail or expected files don't exist.

4. **Convergence or cap** — staged autonomous flows must have `<!-- flow:done -->` sentinels or `iterations:` caps. No infinite loops in the background.

```yaml
# Good autonomous role design
- name: "Autonomous Developer"
  delegate: true
  prompt: |
    You are an autonomous developer. You will NOT receive
    additional instructions after starting.

    If you encounter an error:
    1. Try an alternative approach
    2. If that fails, document the error and move on
    3. NEVER stop and wait for instructions

    Output a complete implementation. Do not ask follow-up questions.
```

## What You Learned

- `delegate: true` routes execution to background — use for long-running tasks
- Worktree isolation prevents delegated changes from affecting your workspace
- Human gates and delegation are incompatible on the same role — compose them sequentially
- Autonomous roles need clear input, self-contained output, and error handling

## Next Steps

Final tutorial: [Case Study](/tutorials/case-study-full-cycle/) — walk through designing a complete flow, seeing every pattern composed.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

