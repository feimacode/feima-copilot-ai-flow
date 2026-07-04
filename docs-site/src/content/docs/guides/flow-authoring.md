---
title: Flow Authoring Concepts
description: How to think about role decomposition, effective prompts, and pattern selection
---

## The Core Idea

A flow is a **delegation of thinking**. Instead of one generalist prompt that does everything, you decompose a task into roles — each with a focused perspective, specific tools, and narrow responsibilities.

## Role Decomposition

### The "Distinct Perspective" Rule

Every role should have a perspective that the others don't. If two roles would produce similar output, merge them.

**Too vague:**
```yaml
roles:
  - name: Reviewer 1
    prompt: Review the code
  - name: Reviewer 2
    prompt: Also review the code
```

**Distinct perspectives:**
```yaml
roles:
  - name: Logic & Correctness Reviewer
    prompt: Focus on algorithm correctness, edge cases, logical errors
  - name: Style & Security Reviewer
    prompt: Focus on vulnerabilities, naming conventions, maintainability
  - name: Verdict
    prompt: Synthesize findings into prioritized recommendations
```

### Role Count Guidelines

| Task Complexity | Recommended Roles |
|-----------------|-------------------|
| Simple (one concern) | 2-3 |
| Moderate (multiple concerns) | 3-5 |
| Complex (cross-cutting, team-scale) | 5-8 |

More than 8 roles rarely helps — token budget and latency become issues.

## Writing Effective Role Prompts

Each role prompt should follow this structure:

```yaml
- name: "Role Name"
  prompt: |
    You are a [role identity with specific expertise].

    Your responsibilities:
    - [Specific responsibility 1]
    - [Specific responsibility 2]

    Process:
    1. [First step — what to do first]
    2. [Second step]
    3. [Third step — produce output]

    Output format:
    ## [Section Name]

    | Column | Column | Column |
    |--------|--------|--------|
    [Structured table format]
```

### Prompt Writing Tips

- **Be specific about the output format.** Tables with columns force structured thinking.
- **Number the process steps.** This creates a clear execution order.
- **Use "You are" not "Act as".** It produces more consistent role behavior.
- **Include edge case handling in responsibilities.** "Identify edge cases and boundary conditions" in every reviewer.

## sharedContext Best Practices

Every flow should include `sharedContext` — it's self-documentation that helps users AND provides the model with persistent context:

```yaml
sharedContext: |
  # [Flow Name]

  ## What This Does
  [One paragraph]

  ## When to Use
  - [Scenario 1]
  - [Scenario 2]

  ## How It Works
  [Role sequence]

  ## Example
  ```
  @flow #file:[filename].flow.yaml
  [sample input]
  ```

  ## What You'll Get
  [Expected output]

  ## Customize It
  - [Hint 1]
  - [Hint 2]
```

## Pattern Selection

See [Choosing Execution Patterns](/guides/execution-patterns/) for the decision tree. Quick reference:

| Pattern | When | Avoid When |
|---------|------|------------|
| Pipeline | Clear sequential steps | Roles are independent |
| Staged | Need iteration/consensus | One pass is enough |
| Fork-Join | Parallel independent analysis | Groups share dependencies |


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

