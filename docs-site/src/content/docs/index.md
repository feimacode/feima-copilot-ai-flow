---
title: AI Flow — Multi-Agent Orchestration for VS Code
description: Define autonomous AI workflows as version-controlled YAML files in VS Code. Pipeline, iterative, and fork-join orchestration with built-in flows for code review, sprint planning, and incident response.
---

<div style="text-align: center; padding: 2rem 0;">

# AI Flow

## Multi-Agent Orchestration for VS Code

Define autonomous AI workflows as `.flow.yaml` files. Run pipeline, iterative, and fork-join orchestrations. Get consistent, repeatable results — every time.

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow"
   style="display: inline-block; background: #0078d4; color: #fff; padding: 12px 32px; border-radius: 6px;
          font-size: 1.1rem; font-weight: 600; text-decoration: none; margin-top: 1rem;">
   ⬇ Install from VS Code Marketplace
</a>

<p style="margin-top: 0.75rem; font-size: 0.9rem; color: var(--sl-color-gray-3);">
Free · Open Source · MIT License
</p>

</div>

---

## What Is AI Flow?

**AI Flow** adds `@flow` to your Copilot Chat — a participant that runs multi-role AI workflows defined in `.flow.yaml` files checked into your repo.

Each role gets its own system prompt, tools, and context window. Roles run autonomously through full tool-use loops, then hand off to the next role.

```yaml
# code-review.flow.yaml — owned by your team, versioned in your repo
name: Code Review
roles:
  - name: Logic & Correctness
    prompt: Review for logical errors, edge cases, and correctness.
    tools: [copilot_readFile, copilot_findTextInFiles]
  - name: Style & Security
    prompt: Review for code style violations and OWASP Top 10 security issues.
  - name: Verdict
    prompt: Synthesize findings into a prioritized, actionable review.
```

## Three Orchestration Primitives

| Pattern | YAML Key | Use When |
|---|---|---|
| **Pipeline** | `roles:` | Sequential review — each role builds on prior output |
| **Iterative** | `stages:` | Refinement loops until quality converges |
| **Fork-Join** | `groups:` + `join:` | Parallel investigations merged by a synthesizer |

## Quick Start

```bash
@flow /create a code review with separate security and style lenses
```

Then run it:

```bash
@flow #file:.github/flows/code-review.flow.yaml
```

Three specialized reviewers analyze your code in sequence and produce a prioritized verdict.

## Where to Start

**New to flows?**
- **[Hello, Flow](/tutorials/hello-world/)** — core concepts in 2 minutes
- **[Quick Start](/getting-started/quickstart/)** — run your first flow

**Building real workflows?**
- **[Pipeline Basics](/tutorials/pipeline-basics/)** — sequential multi-role orchestration
- **[Your First Flow](/tutorials/your-first-flow/)** — create and customize from scratch

**Going deep?**
- **[Quality Gates](/tutorials/quality-gates/)** — build quality into your flows
- **[Autonomous Design](/tutorials/autonomous-design/)** — design for unattended execution

---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow"
   style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px;
          font-weight: 600; text-decoration: none;">
   ⬇ Install AI Flow from the VS Code Marketplace
</a>
