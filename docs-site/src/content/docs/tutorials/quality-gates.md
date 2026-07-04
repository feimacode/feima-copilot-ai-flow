---
title: Quality Gates
description: Build quality into flows with human gates, critic loops, and adversarial roles
---

## Beyond the Basics

You know how to write a pipeline. But pipelines produce output — they don't guarantee quality. This tutorial teaches three patterns that build quality checks INTO the flow, so bad output is caught before it reaches you.

## Pattern 1: Human Gate

**Problem:** The user's query is vague. Downstream roles make assumptions. Output is wrong because the wrong question was answered.

**Solution:** Insert a Commander role that calls `vscode_askQuestions` before any execution.

```
Naive:  [Analyst] → [Writer] → done
                      ↑ makes assumptions, gets it wrong

Fixed:  [Commander 🔴] → [Analyst] → [Writer] → done
         asksQuestions    works with real answers
```

**Real example:** `war-room-triage.flow.yaml` — the Incident Commander asks structured questions about severity, impact, timeline, and symptoms before the investigation team starts. Without this gate, investigators would guess at critical details.

**When to gate:**
- The task is ambiguous (scope, priority, constraints unclear)
- Wrong assumptions would cause significant rework
- You want to constrain downstream roles to specific boundaries

**When NOT to gate:**
- The query is already specific and complete
- The flow is a quick check (gating adds latency)
- The flow runs autonomously (`delegate: true` — gates don't work in background)

## Pattern 2: Critic Loop

**Problem:** The first pass is often good but not great. You re-run the flow manually. Repetitive and unpredictable.

**Solution:** Add a Critic role in a staged loop. The Critic evaluates output against clear criteria. If it passes, the loop exits. If not, the Writer gets specific feedback and revises.

```
Naive:  [Writer] → done
         70% quality

Fixed:  [Writer] → [Critic] → (passes?) → done
                       ↓ (fails)
                 [Writer revises] → [Critic] → ...
                                       90%+ quality
```

**Real example:** `sdd-openspec-full-cycle.flow.yaml` — the Requirements stage has a Requirements Critic that validates completeness, checks for missing non-functional requirements, and verifies priority/size annotations. The loop exits when the spec meets all criteria.

**When to loop:**
- Output quality varies significantly between runs
- There are objective quality criteria (completeness, format, accuracy)
- The cost of bad output is high (specifications, production code)

**When NOT to loop:**
- Quality is consistently good on first pass
- The criteria are subjective (critic gives vague feedback)
- The task benefits from human review more than AI review

## Pattern 3: Adversarial Role

**Problem:** A reviewer who shares the writer's perspective misses blind spots. Reviews are polite, not thorough.

**Solution:** Add a role whose explicit purpose is to BREAK the output. An Edge Case Hunter, a Security Penetration Tester, a Devil's Advocate.

```
Naive:  [Designer] → [Writer] → done
                         ↑ no one tries to break it

Fixed:  [Designer] → [Writer] → [Edge Case Hunter 🦊] → done
                                   actively tries to break it
```

**Real example:** `test-writing.flow.yaml` — the Edge Case Hunter role challenges test coverage, finds missing edge cases, proposes adversarial inputs, and identifies untested error paths. Its job is to find what the Test Writer missed.

**When to use adversarial roles:**
- Security-critical code (penetration testing mindset)
- Testing (coverage gaps are hard to see from the writer's perspective)
- Design reviews (someone needs to play devil's advocate)

**When NOT to use:**
- Simple, well-understood tasks
- When the adversarial role becomes a bottleneck (unnecessary scrutiny)

## Composing the Patterns

These patterns compose. The most powerful flows use all three:

```
[Commander 🔴] → [Analyst] → [Critic] → [Writer] → [Hunter 🦊] → done
    gate          staged loop               adversarial
```

**Real example:** `sdd-openspec-full-cycle.flow.yaml` uses all three:
1. **Human Gate** — Requirements Clarifier asks questions before anything else
2. **Critic Loop** — Requirements Critic validates the spec in a staged loop
3. **Adversarial** — Later stages challenge the architecture and implementation

## What You Learned

- Human gates prevent downstream execution on bad assumptions
- Critic loops improve output through structured iteration
- Adversarial roles find gaps that sympathetic reviewers miss
- These patterns compose — use them together for mission-critical flows

## Next Steps

Learn [efficiency patterns](/tutorials/efficiency-patterns/) — keep flows fast and cost-effective with tool strategy, context budgeting, and skills.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

