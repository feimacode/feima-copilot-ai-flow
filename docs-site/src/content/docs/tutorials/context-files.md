---
title: Context Files
description: Give roles persistent access to project documentation by injecting files as context
---

## What You'll Build

A flow that automatically reads your project's `README.md` and `package.json` and uses them as context — no need to attach them every time you run the flow.

## The Problem

Without `contexts:`, you'd type `#file:README.md` in every chat message. With `contexts:`, the files are injected automatically — every run, every role.

```yaml
contexts:
  - README.md            # always available
  - docs/architecture.md  # always available
roles:
  - name: "Analyst"
    prompt: |            # can reference context files
      Read the user's question and use the provided context files...
```

## Step 1: Install and Open

```
@flow /install 04-context-files
```

Open `.github/flows/04-context-files.flow.yaml`. Notice the `contexts:` list at the flow level:

<a href="vscode://feima.copilot-ai-flow/open?flow=04-context-files">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=04-context-files">🔧 Open in Insiders</a>

```yaml
contexts:
  - README.md
  - package.json
```

Files listed here are read and injected into every role's context. The role prompts can reference them — the content is already available.

## Step 2: Understand Token Budget

Context files don't come for free. Every file you list consumes token budget. When the budget is tight, the system drops elements in this order:

| Priority | Element | Dropped? |
|----------|---------|----------|
| 1000 | Role system prompt | Never |
| 950 | User query | Never |
| 900 | Editor / workspace context | Rarely |
| 700 | Conversation history | Sometimes |
| 600 | Context files | **First to go** |

**Rule of thumb**: Include files the role genuinely needs. Don't dump your entire `docs/` folder — be selective.

## Step 3: sharedContext vs. contexts:

| | `sharedContext` | `contexts:` |
|---|---|---|
| What it is | Inline text in the YAML | File paths on disk |
| When to use | Short, stable instructions (< 1 page) | Longer reference docs, standards, configs |
| Example | "Use TypeScript strict mode" | `docs/coding-standards.md` |
| Persists? | Lives in the flow file | Reads from workspace on each run |

Use `sharedContext` for short, flow-specific guidance. Use `contexts:` for documents you maintain separately.

## Step 4: Run with Context

```
@flow #file:.github/flows/04-context-files.flow.yaml

Based on our project setup, what testing framework should we add?
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F04-context-files.flow.yaml%0A%0ABased%20on%20our%20project%20setup%2C%20what%20testing%20framework%20should%20we%20add%3F">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F04-context-files.flow.yaml%0A%0ABased%20on%20our%20project%20setup%2C%20what%20testing%20framework%20should%20we%20add%3F">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/04-context-files.flow.yaml`</small>

<a href="../../assets/screenshots/context-files-output.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/context-files-output.png" alt="Role output referencing context files from the workspace" /></a>

The Analyst sees your actual `README.md` and `package.json`, references specific sections, and flags what the context files don't cover.

## Where Context Files Are Inherited

Context files declared at different levels are **merged** — lower levels inherit from higher levels:

```yaml
contexts:                           # flow level — all roles get these
  - docs/architecture.md
roles:
  - name: "Security Reviewer"
    contexts:                       # role level — this role ALSO gets these
      - docs/security-checklist.md
```

The Security Reviewer gets BOTH files. Other roles get only `architecture.md`.

## What You Got

- Persistent context injection without re-attaching files
- Understanding of token budget priority — context files drop first
- Knowing when to use `contexts:` vs. `sharedContext`

## Next Steps

Learn [dialog simulation](/tutorials/dialog-simulator/) — create multi-persona conversations.
