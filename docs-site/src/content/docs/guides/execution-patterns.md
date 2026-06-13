---
title: Choosing Execution Patterns
description: When to use pipeline, staged iteration, or fork-join
---

## The Three Patterns

Copilot AI Flow supports three structural patterns. The pattern is inferred from which YAML key you use.

### Pipeline (`roles:`)

Roles execute sequentially — each sees the previous role's output.

```
[Role A] → [Role B] → [Role C]
```

**Best for:**
- Code review (correctness → security → verdict)
- PR descriptions (historian → assessor → writer)
- Document generation (research → draft → review)

**When not to use:** When roles don't depend on each other's output. Parallel patterns are faster.

### Iterative (`stages:`)

Roles loop up to N iterations. Exits early when any role outputs `<!-- flow:done -->`.

```
[Stage: Team Discussion (iterations: 3)]
  [Role A] → [Role B] → [Role C]  →  (converges? exit : loop)
```

**Best for:**
- Estimation where perspectives may conflict
- Design reviews that need consensus
- Any workflow where "discuss until agreement"

**When not to use:** Simple pipelines where one pass is sufficient. Don't add iteration for its own sake.

### Fork-Join (`groups:` + `join:`)

Roles in different groups run in parallel. A join role synthesizes all outputs.

```
[Group A: Security] ────┐
[Group B: Performance] ─┤──→ [Join: Synthesis]
[Group C: Data Layer]  ──┘
```

**Best for:**
- Incident triage (parallel investigation across layers)
- Multi-perspective analysis (security, performance, cost — all at once)
- Bake-off comparisons (two approaches, one reviewer)

**When not to use:** When groups share dependencies. Fork-join requires truly independent analysis.

## Decision Tree

```
Is there one clear sequence of steps?
  ├── Yes → Pipeline (roles:)
  └── No → Do roles need to iterate until agreement?
            ├── Yes → Staged (stages:)
            └── No → Can roles run independently in parallel?
                      ├── Yes → Fork-Join (groups: + join:)
                      └── No → Pipeline (roles:)
```

## The Two Role Axes

Every role has two independent axes:

| Axis | Controls | Options |
|------|----------|---------|
| **Content source** | Where the system prompt comes from | `prompt:` (inline) or `agent:` (file reference) |
| **Execution path** | Which runtime handles the call | Default (VS Code LM API) or `delegate: true` (Copilot SDK) |

These are orthogonal — you can combine them:

```yaml
roles:
  - name: Architect
    agent: alex              # content from .github/agents/alex.agent.md
    delegate: true           # execution via Copilot SDK
```

## Context Inheritance

Skills, contexts, and tools declared at the flow level are inherited by all roles:

```yaml
contexts:
  - docs/architecture.md    # available to every role
skills:
  - sdd-terminology         # available to every role
tools:
  - copilot_readFile        # available to every role
roles:
  - name: Reviewer
    contexts:
      - docs/review-checklist.md  # additional, role-specific context
```
