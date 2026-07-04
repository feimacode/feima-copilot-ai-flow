---
title: Human Gate
description: Pause execution to gather structured user input with vscode_askQuestions before downstream roles run
---

## What You'll Build

A flow that **pauses** to ask you structured questions before executing. A **Commander** gathers your answers, then an **Executor** acts within the constraints you set.

```
[Commander (🔴 pauses)] → [Executor]
   asks questions             acts on answers
```

## The Key Tool: `vscode_askQuestions`

`vscode_askQuestions` is the tool that makes human gates possible. When a role calls it:

1. Execution **pauses**
2. The user sees structured questions in the chat UI — each with clickable option labels
3. The user selects options (or types custom answers)
4. Execution **resumes** with the answers available to the role

This is the only tool that requires human interaction during execution.

## Step 1: Install and Open

```
@flow /install 06-human-gate
```

Open `.github/flows/06-human-gate.flow.yaml`. Notice:

<a href="vscode://feima.copilot-ai-flow/open?flow=06-human-gate">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=06-human-gate">🔧 Open in Insiders</a>

```yaml
tools:
  - vscode_askQuestions       # required for the gate

roles:
  - name: "Commander (Gate)"
    prompt: |
      Call `vscode_askQuestions` ONCE with all questions in a single invocation...
  - name: "Executor"
    tools:
      - copilot_readFile      # Executor gets its own tools
      - copilot_findTextInFiles
```

The Commander has `vscode_askQuestions`. The Executor has code tools. They get different tool sets because they do different things.

## Step 2: The Single-Invocation Rule

**Always call `vscode_askQuestions` ONCE with ALL questions.** Never call it multiple times sequentially.

```yaml
# ✅ Correct — one call, all questions
Call `vscode_askQuestions` ONCE with:
- Question 1: "What is the scope?" [options]
- Question 2: "What are the constraints?" [options]
- Question 3: "What is the priority?" [options]

# ❌ Wrong — sequential calls
Call `vscode_askQuestions` with question 1...
Wait for answer...
Call `vscode_askQuestions` with question 2...
```

Each invocation pauses execution. Two pauses = bad user experience.

## Step 3: Crafting Good Questions

For each question, provide 3-5 concrete option labels. The first option should be the sensible default.

```yaml
Call `vscode_askQuestions` ONCE with all questions in a single invocation.

Questions to ask:
- "What is the scope size?"
  Options: [Small (1 file), Medium (2-5 files), Large (5+ files), Cross-cutting, Unknown]

- "Are there any constraints?"
  Options: [Must not change API, Must preserve backward compatibility, Must follow existing patterns, No constraints, Other]
```

The option labels carry the nuance — keep questions to one sentence each.

## Step 4: Run with a Gate

```
@flow #file:.github/flows/06-human-gate.flow.yaml

I need to add error handling to our API endpoints
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F06-human-gate.flow.yaml%0A%0AI%20need%20to%20add%20error%20handling%20to%20our%20API%20endpoints">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F06-human-gate.flow.yaml%0A%0AI%20need%20to%20add%20error%20handling%20to%20our%20API%20endpoints">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/06-human-gate.flow.yaml`</small>

<a href="../../assets/screenshots/human-gate.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/human-gate.png" alt="Human gate with vscode_askQuestions dialog and downstream execution" /></a>

The flow:

1. **Commander** asks you structured questions about scope, constraints, priority
2. You click options for each question
3. **Commander** produces a Directive — a clear brief with your answers as constraints
4. **Executor** reads the Directive and executes within those boundaries

## Human Gates and Delegation Don't Mix

`vscode_askQuestions` requires human interaction. `delegate: true` sends execution to the background (no UI). They're incompatible:

```yaml
# ❌ Doesn't work — delegated roles can't ask questions
- name: "Commander"
  delegate: true           # background execution
  prompt: |
    Call vscode_askQuestions...  # no one will answer!

# ✅ Works — gate is interactive, executor is delegated
- name: "Commander"
  # no delegate — user answers questions
- name: "Executor"
  delegate: true           # runs in background after gate
```

## What You Got

- A human-in-the-loop flow that gathers structured input before executing
- Understanding of the `vscode_askQuestions` tool and single-invocation pattern
- Knowing how to construct effective questions with option labels

## Where to Go From Here

You've completed all the basic tutorials. Move to [In Practice](/tutorials/your-first-flow/) to apply these concepts in a real workflow, or dive into [Advanced](/tutorials/quality-gates/) to learn flow author design patterns.


---

<a href="https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow" style="display: inline-block; background: #0078d4; color: #fff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">⬇ Install AI Flow from the VS Code Marketplace</a>

