---
title: Iteration & Convergence
description: Loop roles until quality is met with staged iteration and the convergence sentinel
---

## What You'll Build

A staged flow where **Writer** and **Critic** loop until the output meets quality criteria. If the draft is good on the first try, the loop exits immediately — no wasted work.

```
[Writer] → [Critic] → (passes?) → done
                ↓ (fails)
          [Writer revises] → [Critic] → ...
```

## Step 1: Install and Open

```
@flow /install 02-iterative-refine
```

Open `.github/flows/02-iterative-refine.flow.yaml`. Notice the different structure:

<a href="vscode://feima.copilot-ai-flow/open?flow=02-iterative-refine">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=02-iterative-refine">🔧 Open in Insiders</a>

```yaml
stages:
  - name: "Refinement Loop"
    iterations: 3       # max 3 loops
    roles:
      - name: "Writer"
      - name: "Critic"
```

Instead of `roles:` at the top level, we have `stages:` — each stage contains roles that loop.

## Step 2: Understand Convergence

The **Critic** has this instruction:

```
If the draft meets ALL criteria, output ONLY:
<!-- flow:done -->
```

The `<!-- flow:done -->` sentinel is the convergence signal. When ANY role in a stage outputs this exact text (on its own line), the stage exits early — no need to run all `iterations:`.

This means:
- **Good output** → 1 pass, exits early
- **Needs work** → up to 3 passes
- **Never good enough** → stops at 3 regardless (the cap prevents infinite loops)

## Step 3: Run with Iteration

```
@flow #file:.github/flows/02-iterative-refine.flow.yaml

Write a one-page proposal for migrating our monolith to microservices
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F02-iterative-refine.flow.yaml%0A%0AWrite%20a%20one-page%20proposal%20for%20migrating%20our%20monolith%20to%20microservices">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F02-iterative-refine.flow.yaml%0A%0AWrite%20a%20one-page%20proposal%20for%20migrating%20our%20monolith%20to%20microservices">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/02-iterative-refine.flow.yaml`</small>

<a href="../../assets/screenshots/iteration-convergence.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/iteration-convergence.png" alt="Staged iteration with Writer/Critic loop and flow:done convergence" /></a>

Watch what happens:

1. **Writer** produces a draft
2. **Critic** evaluates against 4 criteria (clear, accurate, complete, concise)
3. If the draft passes all 4 → `<!-- flow:done -->` appears and the stage ends
4. If not → Critic gives specific feedback, Writer revises, loop continues

## When to Use Iteration vs. Pipeline

| Scenario | Pipeline | Staged |
|----------|----------|--------|
| Well-defined task, predictable output | ✓ Faster | Overkill |
| Quality matters, output varies by attempt | May miss issues | ✓ Loops to quality |
| Single pass is usually enough | ✓ Simpler | Adds latency |
| Need built-in quality gate | Manual review needed | ✓ Automatic |

**Rule of thumb**: Start with pipeline. Add iteration when you find yourself re-running flows because the first output wasn't good enough.

## What You Got

- A staged flow that loops until quality criteria are met
- Understanding of the `<!-- flow:done -->` convergence sentinel
- Knowing when to choose iteration over simple pipeline

## Next Steps

Learn [fork-join](/tutorials/fork-join/) — run roles in parallel and synthesise the results.
