---
title: Propose-Review-Moderate-Apply
description: Build a multi-agent harness that runs autonomously for hours, iteratively refining output through separate proposer, reviewer, and moderator roles — then applying the final result to your workspace
---

## Why Naive Single-Agent Runs Fall Short

When you ask a coding agent to tackle a complex task, it often starts strong but degrades over time. Two failure modes consistently appear:

**Context decay.** As the context window fills, models lose coherence on lengthy tasks. Some models also exhibit "context anxiety" — wrapping up work prematurely as they approach what they believe is their context limit. The solution isn't just compaction (summarizing earlier conversation in place); it's **context resets** — clearing the window entirely and starting a fresh agent with a structured handoff that carries the previous state and next steps.

**Self-evaluation bias.** When asked to evaluate work they've produced, agents tend to confidently praise it — even when the quality is obviously mediocre. This is especially pronounced for subjective tasks where there's no binary pass/fail check. **Separating the agent doing the work from the agent judging it** proves to be a strong lever. An external evaluator tuned to be skeptical is far more tractable than making a generator critical of its own work.

The `Propose-Review-Moderate-Apply` flow encodes both insights into a reusable harness pattern.

## The Architecture

This flow implements a three-agent GAN-inspired pattern:

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Propose-Review-Moderate Cycle (up to 10 loops)    │
│                                                             │
│  [Proposer] → [Reviewer] → [Moderator]                     │
│      ↑                       ↓ (CONTINUE)                   │
│      └─────── loop ──────────┘                              │
│                        ↓ (DONE)                             │
├─────────────────────────────────────────────────────────────┤
│  Stage 2: Apply Changes (single pass)                       │
│                                                             │
│  [Code Applier] → workspace files modified                  │
└─────────────────────────────────────────────────────────────┘
```

Each role addresses a specific gap observed in single-agent runs:

| Role | Responsibility | Why Separate? |
|------|---------------|---------------|
| **Proposer** | Creates/refines the proposal or implementation | Focused on generation without self-judgment bias |
| **Reviewer** | Evaluates against an ideal solution, identifies gaps | Tuned to be skeptical, not generous |
| **Moderator** | Decides if the task is done or needs another iteration | Makes the DONE/CONTINUE call with full context |
| **Code Applier** | Applies the final result to workspace files | Clean separation between deliberation and mutation |

## Key Harness Design Principles

### 1. Context Resets via Stage Boundaries

Each iteration in the cycle naturally produces a clean handoff. The Moderator's decision becomes the structured artifact that the next Proposer reads. When the cycle reaches its iteration cap or the Moderator calls DONE, the Apply Changes stage starts fresh — no accumulated context anxiety, just the final proposal and a clear task.

This differs from compaction, where earlier conversation is summarized in place. A reset provides a clean slate, at the cost of the handoff artifact having enough state for the next agent to pick up cleanly. The flow's structured output formats ensure this handoff is always complete.

### 2. Making Subjective Quality Gradable

Aesthetics and design quality can't be fully reduced to a score — but they **can** be improved with grading criteria that encode principles and preferences. The Reviewer doesn't ask "is this good?" — it asks specific, answerable questions:

- Are there missing edge cases?
- Is error handling complete?
- Does it follow best practices for logging, performance, security?
- What would a "perfect" implementation from an advanced coding agent look like, and where does this fall short?

The Reviewer produces a structured gap analysis table with severity ratings, giving the Proposer concrete items to iterate against — not vague criticism.

### 3. The Convergence Sentinel

The Moderator outputs `<!-- flow:done -->` when the task is complete. This is the convergence signal — when ANY role in a stage outputs this exact text, the stage exits early. No need to run all 10 iterations if quality is reached on round 3.

This means:
- **Good output** → exits early, saves tokens
- **Needs work** → up to 10 passes
- **Never good enough** → stops at 10 regardless (the cap prevents infinite loops)

### 4. Separation of Deliberation and Mutation

The Code Applier in Stage 2 is deliberately separate from the deliberation cycle. This follows the principle that **file modification should only happen after quality is verified**. The Proposer/Reviewer/Moderator cycle debates, refines, and converges — then the Applier executes. No half-baked changes land in your workspace.

## The Flow File

<a href="vscode://feima.copilot-ai-flow/open?flow=iterative-gap-analysis">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=iterative-gap-analysis">🔧 Open in Insiders</a>

```yaml
name: "Propose-Review-Moderate-Apply"
description: "Refine a proposal through iterative cycles of proposal, review, and moderation, then apply the final result to the workspace."
category: "software-development"
difficulty: "advanced"
tags: ["iterative", "propose-review", "moderation", "code-review", "task-refinement", "code-application"]
contexts: []
stages:
  - name: "Propose-Review-Moderate Cycle"
    iterations: 10
    doneWord: "<!-- flow:done -->"
    roles:
      - name: "Proposer"
        # Creates/refines proposal based on task and feedback
      - name: "Reviewer"
        # Evaluates against ideal, identifies gaps with severity
      - name: "Moderator"
        # Decides DONE or CONTINUE with reasoning
  - name: "Apply Changes"
    iterations: 1
    roles:
      - name: "Code Applier"
        # Applies final result to workspace files
```

## Running the Flow

### Basic Usage

```
@flow /install iterative-gap-analysis
```

Then invoke it with your task:

```
@flow #file:.github/flows/propose-review-moderate-apply.flow.yaml

Refactor the authentication module to support OAuth2 with PKCE
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fpropose-review-moderate-apply.flow.yaml%0A%0ARefactor%20the%20authentication%20module%20to%20support%20OAuth2%20with%20PKCE">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fpropose-review-moderate-apply.flow.yaml%0A%0ARefactor%20the%20authentication%20module%20to%20support%20OAuth2%20with%20PKCE">🚀 Run in Insiders</a>

### Providing Context

The flow's `contexts:` field is intentionally empty — you supply the context that matters for your task:

```
@flow #file:.github/flows/propose-review-moderate-apply.flow.yaml #file:ARCHITECTURE.md #file:auth/requirements.md

Refactor the authentication module to support OAuth2 with PKCE
```

Or override the contexts in the flow file itself:

```yaml
contexts:
  - "docs/architecture.md"
  - "specs/auth-requirements.md"
  - "src/auth/current-implementation.ts"
```

## What to Expect

### Iteration Patterns

The flow doesn't always converge linearly. Some patterns you'll observe:

- **Incremental refinement** — each round tightens the proposal, fixing identified gaps
- **Strategic pivots** — the Proposer abandons an approach entirely after the Reviewer identifies fundamental flaws
- **Early convergence** — clear tasks may pass review on round 1 or 2
- **Full cycle** — complex tasks may use all 10 iterations before the Moderator calls DONE

### Token Cost vs. Quality

This flow is more expensive than a single-agent run — typically 5-20x the tokens. But the quality difference is immediately apparent:

| Metric | Single Agent | Propose-Review-Moderate |
|--------|-------------|------------------------|
| Edge cases handled | Often missed | Systematically identified |
| Error handling | Incomplete | Comprehensive |
| Best practices | Inconsistent | Enforced by Reviewer |
| Self-awareness | Overconfident | Calibrated by Moderator |
| Final output quality | Variable | Consistently high |

The evaluator is worth the cost when the task sits beyond what the current model does reliably solo. For simple tasks, a pipeline flow is faster. For tasks at the edge of model capability, this harness adds real lift.

## Tuning the Harness

### Adjusting Iteration Count

The default is 10 iterations. Adjust based on your task complexity:

```yaml
stages:
  - name: "Propose-Review-Moderate Cycle"
    iterations: 5      # fewer for simpler tasks
    # iterations: 15   # more for complex, novel domains
```

### Customizing Reviewer Criteria

The Reviewer's prompt can be tuned for your domain. For frontend work, add design criteria:

```yaml
- name: "Reviewer"
  prompt: |
    You are a Reviewer who evaluates the proposer's output against these criteria:
    
    1. **Completeness**: Does it address all requirements?
    2. **Edge cases**: Are boundary conditions handled?
    3. **Error handling**: Are failures graceful?
    4. **Performance**: Are there obvious bottlenecks?
    5. **Security**: Are there injection, auth, or data exposure risks?
    6. **Maintainability**: Is the code clear and well-structured?
```

### Adding Domain-Specific Context

Inject domain knowledge via the `sharedContext` or `contexts:` fields:

```yaml
contexts:
  - "docs/coding-standards.md"
  - "docs/security-checklist.md"
  - "architecture/decision-log.md"
```

## When to Use This Flow

| Scenario | Use This Flow? | Why |
|----------|---------------|-----|
| Complex refactoring | ✅ | Multiple angles catch what one agent misses |
| New feature design | ✅ | Reviewer identifies gaps before code is written |
| Architecture decisions | ✅ | Moderator weighs trade-offs systematically |
| Security-sensitive code | ✅ | Reviewer enforces security criteria |
| Simple bug fix | ❌ | Overkill — use a pipeline |
| Quick code review | ❌ | Overkill — use `code-review.flow.yaml` |
| One-shot generation | ❌ | No iteration needed — use pipeline |

## The Philosophy

> Every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing.

As models improve, some pieces of this harness may become unnecessary. The Reviewer may matter less when the Proposer gets better at self-correction. The 10-iteration cap may be overkill when models sustain coherence longer.

But the core insight holds: **separating generation from evaluation, and wrapping both in a moderation layer, consistently produces better output than any single agent working alone**. The interesting work for AI engineers is finding the next novel combination — not waiting for models to solve everything.

## Related Flows

- [`code-review.flow.yaml`](../../flows/code-review.flow.yaml) — Focused code review without iteration
- [`sdd-openspec-full-cycle.flow.yaml`](../../flows/sdd-openspec-full-cycle.flow.yaml) — Full spec-driven development with critic loops
- [`test-writing.flow.yaml`](../../flows/test-writing.flow.yaml) — Test generation with adversarial edge case hunting
- [`iterative-refine.flow.yaml`](../../examples/02-iterative-refine.flow.yaml) — Simpler Writer/Critic iteration pattern
