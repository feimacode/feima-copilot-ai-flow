---
title: Quick Start
description: Run your first flow in 60 seconds
---

## Your First Flow

Open the Copilot Chat panel and type:

```
@flow /create a code review with separate security and style lenses
```

This generates a valid `.flow.yaml` file in `.github/flows/`. Now run it:

```
@flow #file:.github/flows/code-review.flow.yaml

Review the changes in src/auth/login.ts
```

That's it. The flow runs three specialized reviewers — Logic & Correctness, Style & Security, and a Verdict synthesizer — each building on the previous output.

## What Just Happened

1. `@flow /create` used AI to generate a complete flow from your description
2. The flow was saved to `.github/flows/` — you own it, you can edit it
3. `@flow #file:` ran the flow, executing each role in sequence
4. Each role saw the previous role's output and built on it

## Try Another Flow

The built-in library has production-ready flows you can install:

```
@flow /install story-estimation
@flow #file:.github/flows/story-estimation.flow.yaml

Story: Add user authentication with JWT tokens
- Login endpoint with email/password
- Token validation middleware
- Refresh token rotation
```

## What's Next

- [Make It Yours](/tutorials/customize-flow/) — customize a flow's roles and prompts
- [Connect to Jira](/tutorials/jira-integration/) — integrate with your tools
- [Browse the Gallery](#) — open `AI Flow: Open Flow Gallery` from the command palette
