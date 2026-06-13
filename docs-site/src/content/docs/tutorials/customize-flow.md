---
title: Make It Yours
description: Customize a flow's roles, prompts, and context for your team
---

## What You'll Do

Take the generated code review flow and customize it for your team's conventions, coding standards, and review checklist.

## Step 1: Open the Flow File

Open `.github/flows/code-review.flow.yaml` in VS Code. The file has YAML syntax highlighting and schema validation (from `flow.schema.json`).

## Step 2: Customize Role Prompts

Edit the **Style & Security Reviewer** prompt to include your team's specific standards:

```yaml
- name: "Style & Security Reviewer"
  prompt: |
    You are a code reviewer specializing in style and security.

    Our team conventions:
    - Use TypeScript strict mode
    - Prefer functional components over class components
    - All user-facing strings must use the i18n framework
    - API routes must validate input with zod schemas

    Analyze for:
    - Security vulnerabilities (OWASP Top 10)
    - Compliance with team conventions above
    - Input validation and sanitization
    ...
```

## Step 3: Add Context Files

Add a `contexts:` field pointing to your team's coding standards:

```yaml
contexts:
  - docs/coding-standards.md
  - docs/security-guidelines.md
```

These files are automatically injected as lower-priority context for every role. They persist across runs — no need to re-attach them each time.

## Step 4: Adjust Tools

If your reviewers need more tools:

```yaml
tools:
  - copilot_readFile
  - copilot_findTextInFiles
  - copilot_replaceString    # enables suggesting fixes inline
```

## Step 5: Run Your Customized Flow

```
@flow #file:.github/flows/code-review.flow.yaml

Review the PR at src/api/payments.ts
```

The reviewers now apply your team's specific conventions and have access to your coding standards.

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fcode-review.flow.yaml%0A%0AReview%20the%20PR%20at%20">🚀 Run in Copilot</a>

## What's Next

Now that your flow is customized, [connect it to Jira](/tutorials/jira-integration/) to automatically create tickets from review findings.
