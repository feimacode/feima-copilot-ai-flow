---
title: Pipeline Basics
description: Chain three specialized roles — analyst, reviewer, summariser — in a sequential pipeline
---

## What You'll Build

A three-role pipeline: **Analyst** investigates, **Reviewer** evaluates, **Summariser** reports. Each role builds on the previous output — the fundamental flow pattern.

```
[Analyst] → [Reviewer] → [Summariser]
```

## Step 1: Install and Open

Install the example flow:

```
@flow /install 01-pipeline-review
```

Open `.github/flows/01-pipeline-review.flow.yaml`. Notice the three roles each have a distinct perspective:

<a href="vscode://feima.copilot-ai-flow/open?flow=01-pipeline-review">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=01-pipeline-review">🔧 Open in Insiders</a>

| Role | Perspective | Output |
|------|-------------|--------|
| Analyst | Fact-finding | Patterns, facts, areas of interest |
| Reviewer | Evaluation | Validated findings, gaps, priorities |
| Summariser | Synthesis | Bottom line, key findings, actions |

## Step 2: Run the Pipeline

```
@flow #file:.github/flows/01-pipeline-review.flow.yaml

Review the architecture of our payment processing service.
It handles 10k transactions/hour through a single queue.
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F01-pipeline-review.flow.yaml%0A%0AReview%20the%20architecture%20of%20our%20payment%20processing%20service.%20It%20handles%2010k%20transactions%2Fhour%20through%20a%20single%20queue.">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F01-pipeline-review.flow.yaml%0A%0AReview%20the%20architecture%20of%20our%20payment%20processing%20service.%20It%20handles%2010k%20transactions%2Fhour%20through%20a%20single%20queue.">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/01-pipeline-review.flow.yaml`</small>

<a href="../../assets/screenshots/pipeline-basics.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/pipeline-basics.png" alt="Pipeline execution with three sequential roles" /></a>

Watch the handoffs:

1. **Analyst** gathers facts — identifies the single queue as the bottleneck, notes volume patterns
2. **Reviewer** reads the analysis — validates findings, flags missing pieces, prioritises concerns
3. **Summariser** reads both — distills into a one-page executive summary with actions

## Why Pipeline?

The pipeline pattern works when **each role depends on the previous role's output**. The Analyst's findings are the Reviewer's input. The Reviewer's evaluation is the Summariser's input.

If roles don't depend on each other, [fork-join](/tutorials/fork-join/) is faster — roles run in parallel.

## Practice: Add Tools

The example has no tools. Let's add them.

Open `.github/flows/01-pipeline-review.flow.yaml` and add a `tools:` section before `roles:`:

```yaml
tools:
  - copilot_readFile
  - copilot_findTextInFiles

roles:
  ...
```

Now the Analyst can read files and search code — the pipeline becomes more powerful.

Run it again with a real codebase reference:

```
@flow #file:.github/flows/01-pipeline-review.flow.yaml

Review the error handling in src/api/handlers.ts
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F01-pipeline-review.flow.yaml%0A%0AReview%20the%20error%20handling%20in%20src%2Fapi%2Fhandlers.ts">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F01-pipeline-review.flow.yaml%0A%0AReview%20the%20error%20handling%20in%20src%2Fapi%2Fhandlers.ts">🚀 Run in Insiders</a>

The Analyst reads the actual file, finds specific patterns, and the pipeline produces a grounded review.

## What You Got

- A three-role pipeline with distinct, complementary perspectives
- Understanding of sequential handoff — output flows role to role
- Practice adding tools to make roles more capable

## Next Steps

Learn [iteration and convergence](/tutorials/iteration-convergence/) — make roles loop until the output is good enough.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

