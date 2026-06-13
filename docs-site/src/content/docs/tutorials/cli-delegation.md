---
title: Go Autonomous
description: Hand off long-running flows to background execution with CLI delegation
---

## What You'll Build

Configure a flow to run autonomously via the GitHub Copilot SDK — delegating long-running estimation or review sessions to background execution.

## When to Delegate

| Mode | Best For |
|------|----------|
| **VS Code LM API** | Interactive flows, quick reviews, real-time feedback |
| **CLI Delegation** | Long-running estimation, batch reviews, unattended execution |

## Step 1: Add Delegate Annotations

Edit the flow to add `delegate: true` to roles that can run autonomously:

```yaml
roles:
  - name: "Product Owner"
    prompt: |
      You are the Product Owner...
    delegate: true       # runs via Copilot SDK

  - name: "Dev Lead"
    prompt: |
      You are the Dev Lead...
    delegate: true
```

Or enhance it:

```
@flow /enhance story-estimation.flow.yaml --add-cli-delegation
```

## Step 2: Understand Worktree Isolation

When `delegate: true` is set, the Copilot SDK can optionally create a separate Git worktree for the flow execution. This means:

- The flow runs in an isolated environment
- File changes don't affect your working directory
- You can continue working while the flow runs
- Results are available when the flow completes

## Step 3: Run in Background

```
@flow #file:.github/flows/story-estimation.flow.yaml

Estimate the entire Q3 backlog (12 stories):
- [paste backlog items]
```

With `delegate: true`, the flow starts in the background. You get a notification when it completes.

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fstory-estimation.flow.yaml%0A%0AEstimate%20the%20entire%20Q3%20backlog">🚀 Run in Copilot</a>

## What You Got

- Long-running flows that don't block your editor
- Optional worktree isolation for safety
- Batch processing (estimate 12 stories at once, review 5 PRs in sequence)

## You've Completed the Tutorial Chain

You now know how to:
1. [Create flows](/tutorials/your-first-flow/) from natural language
2. [Customize roles](/tutorials/customize-flow/) for your team
3. [Integrate with tools](/tutorials/jira-integration/) like Jira
4. [Add iteration](/tutorials/staged-iteration/) for consensus
5. [Delegate to CLI](/tutorials/cli-delegation/) for autonomous execution

**What to explore next:**
- [Choosing Execution Patterns](/guides/execution-patterns/) — when to use pipeline vs. staged vs. fork-join
- [Flow Authoring Concepts](/guides/flow-authoring/) — how to design effective roles
- [Tool Integration](/guides/tool-integration/) — MCPs, APIs, and external services
