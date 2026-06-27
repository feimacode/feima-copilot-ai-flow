---
title: Your First Flow
description: Create and run your first flow with @flow /create
---

## What You'll Build

A multi-role code review flow that analyzes code from correctness and security perspectives — all from a single natural language description.

## Step 1: Create the Flow

In the Copilot Chat panel:

```
@flow /create a code review with separate security and style lenses
```

The AI generates a complete `.flow.yaml` file with:

- **Two specialized reviewers**: Logic & Correctness, plus Style & Security
- **A Verdict synthesizer**: Combines findings into prioritized recommendations
- **Structured output formats**: Each role produces tables with severity, findings, and recommendations
- **Self-documentation**: The `sharedContext` section explains what, when, how, and how to customize

## Step 2: Run the Flow

```
@flow #file:.github/flows/code-review.flow.yaml

Review the changes in src/auth/login.ts
```

Watch as each role executes in sequence:

1. **Logic & Correctness Reviewer** analyzes algorithm correctness, edge cases, logical errors
2. **Style & Security Reviewer** checks vulnerabilities, style, and maintainability — building on the first reviewer's output
3. **Verdict** synthesizes everything into critical, high, and medium priority issues

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fcode-review.flow.yaml%0A%0AReview%20the%20changes%20in%20">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fcode-review.flow.yaml%0A%0AReview%20the%20changes%20in%20">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/code-review.flow.yaml`</small>

## What You Got

A prioritized review with:

| Priority | Description |
|----------|-------------|
| Critical | Must fix before merge |
| High | Should fix soon |
| Medium | Consider fixing |

Each finding includes severity, location, and specific recommendations.

## Next Steps

The generated flow is a starting point. In the next tutorial, you'll [customize it for your team](/tutorials/customize-flow/).
