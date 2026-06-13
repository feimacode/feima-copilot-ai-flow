---
title: Referencing Files in Flows
description: How to reference agents, prompts, and context files from your flow
---

## Three Reference Methods

### 1. Inline Prompt

The simplest approach — write the prompt directly in the YAML:

```yaml
roles:
  - name: Reviewer
    prompt: |
      You are a code reviewer. Analyze for correctness, security, and style.
      Output findings with severity and recommendations.
```

### 2. URI Reference

Reference an absolute or relative file path:

```yaml
roles:
  - name: Architect
    prompt: file:///home/user/agents/architect.prompt.md

  - name: Security
    prompt: ../agents/security-reviewer.prompt.md
```

URI references resolve relative to the flow file's location.

### 3. Filename Reference

Use just the filename — the system searches in order:

```yaml
roles:
  - name: Architect
    agent: architect    # searches: .github/agents/architect.agent.md
```

**Search order for filename references:**
1. `.github/prompts/` or `.github/agents/`
2. `.vscode/prompts/` or `.vscode/agents/`
3. `~/.copilot/prompts/` or `~/.copilot/agents/`

## Combining prompt and agent

You can use both — the agent file provides the system prompt base, and `prompt:` can add role-specific instructions:

```yaml
roles:
  - name: Architect
    agent: architect              # base personality from agent file
    prompt: |
      Focus specifically on database schema design.
      Flag any N+1 query patterns.
```

## Context Files

Context files are injected at lower priority so they don't consume the token budget for role instructions:

```yaml
contexts:
  - docs/architecture.md          # inline path
  - path: docs/coding-standards.md  # explicit object form
  - docs/adr/                     # directory — all .md files included
```

Context files declared at the flow level are available to all roles. You can also declare them at the role or stage level for scoped context.

## YAML Frontmatter in Prompt Files

Prompt files (`.prompt.md`) can include YAML frontmatter:

```markdown
---
name: Architect Review
version: "1.0"
---

You are a software architect reviewing for...
```

The frontmatter is stripped before the prompt is sent to the model.
