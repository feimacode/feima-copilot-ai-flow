---
title: Add Iteration
description: Convert a pipeline flow to staged iteration for convergence
---

## What You'll Build

Wrap your estimation roles in a `stages:` block so the team iterates until consensus, using a convergence sentinel to exit early.

## Why Iteration

Pipeline flows execute once. For estimation, the first pass may not reach consensus — the Estimator's synthesis might flag contradictory inputs from different roles. Iteration lets roles refine their assessments based on each other's feedback.

## Step 1: Enhance with Staged Iteration

```
@flow /enhance story-estimation.flow.yaml --add-iterative-stage
```

The AI wraps the existing roles in a `stages:` block:

```yaml
stages:
  - name: "Team Estimation"
    iterations: 3
    roles:
      - name: "Product Owner"
        prompt: |
          ...
          If the team has reached consensus (all estimates within 2 points),
          output ONLY: <!-- flow:done -->
      - name: "Dev Lead"
        ...
```

## Step 2: Understand Convergence

The `<!-- flow:done -->` sentinel is critical. When any role in a stage outputs this exact string (on its own line), the stage exits early — no need to run all `iterations`.

**Where to place it:**
- In the Estimator + Splitter role: emit `<!-- flow:done -->` when all perspectives converge within acceptable range
- In a new Consensus Checker role: emit `<!-- flow:done -->` after verifying agreement

## Step 3: Run with Iteration

```
@flow #file:.github/flows/story-estimation.flow.yaml

Story: Refactor the payment processing pipeline
- The current pipeline has 15 steps and is hard to debug
- We need it broken into composable stages with clear error boundaries
```

Watch the team iterate. On ambiguous stories, they may run 2-3 rounds. On clear stories, the convergence sentinel triggers after 1 round.

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fstory-estimation.flow.yaml%0A%0AStory%3A%20Refactor%20the%20payment%20processing%20pipeline">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fstory-estimation.flow.yaml%0A%0AStory%3A%20Refactor%20the%20payment%20processing%20pipeline">🚀 Run in Insiders</a>

## What You Got

- Roles that iterate until consensus, not just one pass
- Early exit via `<!-- flow:done -->` when the team agrees
- Configurable `iterations` cap to prevent infinite loops

## When Iteration Helps

| Scenario | Pipeline | Staged |
|----------|----------|--------|
| Well-understood story | Fine | Slightly slower |
| Ambiguous story with tradeoffs | May miss nuance | Iterates to resolution |
| Large story where perspectives diverge | Produces conflicting output | Refines until convergence |

## Next Steps

For truly long-running estimation sessions, [delegate to CLI execution](/tutorials/cli-delegation/) and check results later.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

