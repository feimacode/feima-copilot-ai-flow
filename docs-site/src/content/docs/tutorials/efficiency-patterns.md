---
title: Efficiency Patterns
description: Keep flows fast and cost-effective with tool strategy, context budgeting, and skill references
---

## The Efficiency Triad

A well-designed flow isn't just correct — it's efficient. Three levers control efficiency:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Tool Strategy     Context Budget    Skills         │
│   ─────────────     ──────────────    ──────         │
│   "Which tools      "How much         "What domain   │
│    per role?"        context?"         knowledge?"   │
│                                                     │
│   Fewer tools =     Less context =    Skills inject  │
│   smaller prompts   faster runs       knowledge      │
│                                       without bloat  │
└─────────────────────────────────────────────────────┘
```

## Lever 1: Tool Strategy

Every tool reference consumes context window. A role with 10 tools has a much larger system prompt than a role with 2 — even if it never uses 8 of them.

**The spectrum:**

| Approach | Tools per role | Context cost | Best for |
|----------|---------------|-------------|----------|
| Minimal | 1-2 | Very low | Focused tasks (code review, analysis) |
| Moderate | 3-4 | Medium | Implementation tasks (read + write + search) |
| Full | 5-7 | High | Complex automation (SDD full cycle, incident response) |

**Real examples:**

```yaml
# code-review.flow.yaml — minimal (2 tools)
tools:
  - copilot_readFile
  - copilot_findTextInFiles

# backlog-ranking.flow.yaml — minimal (2 tools)
tools:
  - copilot_readFile
  - copilot_findTextInFiles

# sdd-openspec-full-cycle.flow.yaml — full (7 tools, justified)
tools:
  - vscode_askQuestions
  - copilot_readFile
  - copilot_findTextInFiles
  - copilot_listDirectory
  - copilot_createFile
  - copilot_replaceString
  - run_in_terminal
  - get_terminal_output
```

**Design principle:** Start minimal. Add tools only when a role demonstrably needs them. The code-review flow works with 2 tools — don't give it 7 "just in case."

## Lever 2: Context Budget

Context flows into a role from multiple sources. When the token budget is tight, lower-priority elements drop first:

| Priority | Source | Management Strategy |
|----------|--------|-------------------|
| 1000 | Role prompt | Keep concise. Use `agent:` for reusable prompts. |
| 950 | User query | Outside your control. |
| 900 | Editor context | Outside your control. |
| 700 | History | Previous role outputs — unavoidable in pipeline. |
| 600 | Context files | **Your biggest lever.** Be selective. |

**Strategies:**

1. **Use `agent:` for long system prompts.** If a role's prompt is 50+ lines, move it to a `.agent.md` file referenced by `agent:`. The content is the same, but you can version it separately.

2. **Be selective with `contexts:`.** Don't reference every doc. Reference the ones roles actually use:
   ```yaml
   # Good — targeted
   contexts:
     - docs/api-contracts.md
     - docs/security-guidelines.md

   # Bad — kitchen sink
   contexts:
     - docs/**/*
   ```

3. **Use `sharedContext` for short, stable guidance.** If it's under half a page, put it in `sharedContext` rather than a separate file (one less file I/O, simpler mental model).

## Lever 3: Skills Integration

Skills are reusable prompt fragments that inject domain knowledge without bloating individual role prompts.

```yaml
skills:
  - sdd-terminology          # All roles know SDD concepts

roles:
  - name: "Requirements Analyst"
    prompt: |
      Produce a Requirements Specification...
    # Can reference SDD terminology without it being in the prompt
```

**Real example:** `sdd-openspec-full-cycle.flow.yaml` uses 4 skills:
```yaml
skills:
  - sdd-terminology
  - openspec-propose
  - openspec-apply-change
  - openspec-archive-change
```

Without skills, these roles would need to explain SDD concepts and OpenSpec workflows in every prompt — massive duplication and context bloat.

**When to use skills:**
- Domain terminology used across multiple roles
- Workflow patterns that multiple roles follow
- Reusable instructions (coding standards, output formats)

**When NOT to use skills:**
- Role-specific instructions (put those in the prompt)
- One-off context (use `contexts:`)
- Short prompts where skills would add indirection without saving tokens

## Efficiency Checklist

Before finalizing a flow, ask:

- [ ] **Tools:** Does every role have ONLY the tools it needs?
- [ ] **Prompts:** Could long prompts be moved to `agent:` files?
- [ ] **Contexts:** Are context files limited to what roles actually reference?
- [ ] **Skills:** Is shared domain knowledge injected via skills, not copied into prompts?
- [ ] **Structure:** Would fork-join be faster than pipeline? Would pipeline be simpler than staged?

## What You Learned

- Tool count is a deliberate design choice — start minimal, add as needed
- Context budget has a priority ladder — context files drop first
- Skills inject domain knowledge without per-role prompt bloat
- Efficiency isn't premature optimization — it's good flow design

## Next Steps

Learn [autonomous design](/tutorials/autonomous-design/) — when to delegate flows to background execution.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

