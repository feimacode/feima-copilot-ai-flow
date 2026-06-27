---
title: "Case Study: Full-Cycle Flow Design"
description: Walk through every design decision in sdd-openspec-full-cycle — from idea to merged PR
---

## The Challenge

> "I want to go from a vague feature idea to a merged PR without leaving the chat."

That's the problem `sdd-openspec-full-cycle.flow.yaml` solves. This case study walks through every major design decision — why staged, not pipeline? Why a critic, not just more iterations? Why skills, not inline prompts?

## Decision 1: Why Staged?

The full cycle has four distinct phases. Each phase has different goals, different roles, and different quality criteria:

```
Stage 1: Clarification      Stage 2: Requirements      Stage 3: Implementation     Stage 4: Archive
───────────────────────     ──────────────────────     ───────────────────────     ──────────────
Human gate only             Analyst + Critic loop       Scaffold + Implement        Cleanup
Iterations: 1               Iterations: 2               Multiple roles              Final step
```

**Why not pipeline?** A pipeline would execute all roles in one sequence. But the Clarification stage MUST complete before Requirements can start — if the human hasn't answered questions, the Requirements Analyst has nothing to work with. Stages create hard checkpoints.

**Why not fork-join?** The stages are sequential by nature — Requirements depends on Clarification output, Implementation depends on Requirements output. Fork-join requires independent work.

**Decision:** `stages:` with 4 stages. Each stage is a logical checkpoint.

## Decision 2: Why a Single Human Gate at the Front?

The only mandatory human interaction is at Stage 1 — the Requirements Clarifier asks 4-6 high-value questions and produces a Preliminary Scope Boundary.

**Why only one gate?** Multiple gates degrade UX. The user's mental model is "I describe my idea, answer a few questions, then the flow runs." Adding gates between stages breaks the autonomous experience.

**Why at the front?** The answers to clarification questions cascade through ALL downstream stages. The Requirements Analyst uses them. The Architect uses them. The Implementer uses them. One gate at the start is sufficient.

**Decision:** Single `vscode_askQuestions` call in Stage 1. All downstream stages run without interruption.

## Decision 3: Why a Critic Loop in Requirements?

Stage 2 (Requirements) uses `iterations: 2` with an Analyst + Critic loop. The Critic validates:

- Every functional requirement has priority AND size
- Non-functional requirements are present and measurable
- Constraints are documented
- Out-of-scope items are explicit

**Why not just `iterations: 3` without a critic?** More iterations without a critic means the Analyst revises its own work. Self-review is less effective than dedicated review. The Critic provides a fresh perspective on the same output.

**Why not a separate stage for the critic?** The Critic's feedback is only useful to the Analyst. A separate stage would pass Critic output to the next stage (Architecture) — that output is irrelevant there. Keeping them in the same stage scopes the loop correctly.

**Decision:** Single stage with Analyst + Critic, `iterations: 2`.

## Decision 4: Why Skills, Not Inline Prompts?

The flow uses 4 skills:

```yaml
skills:
  - sdd-terminology
  - openspec-propose
  - openspec-apply-change
  - openspec-archive-change
```

These inject domain knowledge (SDD concepts, OpenSpec workflows) into every role without copying it into every prompt.

**What if we used inline prompts instead?** Each of the 6+ roles would need to include SDD terminology definitions and OpenSpec workflow instructions. That's hundreds of duplicated lines — massive context bloat and a maintenance nightmare (change one thing, update 6 prompts).

**Why not just put it in `sharedContext`?** `sharedContext` is flow-level context, not domain knowledge. It's for "this specific flow's purpose and usage." Skills are for "knowledge that persists across flows."

**Decision:** Skills for domain knowledge, `sharedContext` for flow documentation, inline prompts for role-specific instructions.

## Decision 5: Which Tools and Where?

The flow uses 7 tools — but not all roles get all tools:

| Stage | Tools | Rationale |
|-------|-------|-----------|
| Clarification | `vscode_askQuestions` | Only needs to ask questions |
| Requirements | `copilot_readFile`, `copilot_findTextInFiles` | Reads existing code/docs for context |
| Implementation | `copilot_readFile`, `copilot_createFile`, `copilot_replaceString`, `copilot_listDirectory`, `run_in_terminal` | Full creation + build verification |
| Archive | `copilot_readFile`, `copilot_findTextInFiles`, `run_in_terminal` | Reads artifacts, runs archive commands |

**Why not give all tools to all roles?** The Requirements Analyst doesn't need `copilot_createFile` or `run_in_terminal` — giving them those tools wastes context window. Each stage gets only what it actually uses.

**Decision:** Stage-scoped tool sets. Minimal per stage.

## The Full Picture

```
┌──────────────────────────────────────────────────────────────┐
│  sdd-openspec-full-cycle                                     │
│                                                              │
│  Stage 1: Clarification (iterations: 1)                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Requirements Clarifier 🔴]                           │    │
│  │   vscode_askQuestions                                │    │
│  │   → Preliminary Scope Boundary                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  Stage 2: Requirements (iterations: 2)                        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Requirements Analyst] ⇄ [Requirements Critic]        │    │
│  │   copilot_readFile         validates completeness     │    │
│  │   → Requirements Spec                                │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  Stage 3: Implementation                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Architect] → [Scaffolder] → [Implementer] → [Tests]  │    │
│  │   design       creates       writes        writes    │    │
│  │               files          code          tests     │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  Stage 4: Archive                                            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Archiver]                                             │    │
│  │   archives OpenSpec change, updates docs               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Skills: sdd-terminology, openspec-propose,                   │
│          openspec-apply-change, openspec-archive-change        │
└──────────────────────────────────────────────────────────────┘
```

## Design Principles Recap

1. **Stages create checkpoints** — use when phases depend on previous phase completion
2. **Single human gate at the front** — gather all ambiguity before autonomous execution
3. **Critic loops validate quality** — fresh perspective beats self-review
4. **Skills for domain knowledge** — inject once, reuse everywhere
5. **Minimal tools per stage** — only what each phase actually uses
6. **Convergence caps** — `iterations:` caps prevent infinite loops

## What You Learned

- The full decision chain behind a complex production flow
- How patterns compose: gates + critics + staged iteration + skills + tool strategy
- When to choose each primitive based on the problem, not the feature list

You've completed the advanced tutorials. You now understand flows from "hello world" through full-cycle autonomous design.
