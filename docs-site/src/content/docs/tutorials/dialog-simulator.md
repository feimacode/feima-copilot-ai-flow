---
title: Dialog Simulator
description: Simulate multi-persona conversations to stress-test proposals and explore perspectives
---

## What You'll Build

A flow where fictional roles simulate a real discussion — an **Architect** presents a proposal to a review board, then a **Dev Lead** and **Project Manager** respond with their natural concerns.

```
[Architect] → [Dev Lead] → [Project Manager]
  presents      questions      evaluates business case
```

## Why Simulate Dialogs?

Before presenting a proposal to real stakeholders, stress-test it with AI personas. They'll surface objections you hadn't considered, ask questions from angles you don't normally think from, and help you prepare for the real meeting.

This pattern works for:
- Architecture review boards
- Sprint planning discussions
- Design critiques
- Risk assessment panels
- Any multi-stakeholder decision

## Step 1: Install and Open

```
@flow /install 05-dialog-simulator
```

Open `.github/flows/05-dialog-simulator.flow.yaml`. Notice that each role has a **persona** and a **perspective**:

<a href="vscode://feima.copilot-ai-flow/open?flow=05-dialog-simulator">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=05-dialog-simulator">🔧 Open in Insiders</a>

```yaml
- name: "Architect (Presenter)"
  prompt: |
    You are a software architect presenting a technical proposal...
- name: "Dev Lead"
  prompt: |
    You are a development lead on the review board...
- name: "Project Manager"
  prompt: |
    You are a project manager on the review board...
```

The "You are..." framing makes each role adopt a specific voice and concerns.

## Step 2: Run the Simulation

The example flow simulates a JavaScript-to-TypeScript migration proposal:

```
@flow #file:.github/flows/05-dialog-simulator.flow.yaml

We're considering adopting micro-frontends for our e-commerce platform.
Our team of 12 currently uses a monolith. Present this to the review board.
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F05-dialog-simulator.flow.yaml%0A%0AWe're%20considering%20adopting%20micro-frontends%20for%20our%20e-commerce%20platform.%20Our%20team%20of%2012%20currently%20uses%20a%20monolith.%20Present%20this%20to%20the%20review%20board.">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F05-dialog-simulator.flow.yaml%0A%0AWe're%20considering%20adopting%20micro-frontends%20for%20our%20e-commerce%20platform.%20Our%20team%20of%2012%20currently%20uses%20a%20monolith.%20Present%20this%20to%20the%20review%20board.">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/05-dialog-simulator.flow.yaml`</small>

<a href="../../assets/screenshots/dialog-simulator.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/dialog-simulator.png" alt="Multi-persona dialog with Architect, Dev Lead, and Project Manager" /></a>

The simulation:

1. **Architect** presents the case — benefits, costs, risks, recommended first step
2. **Dev Lead** pushes back — team impact, timeline realism, migration order
3. **Project Manager** evaluates — business case, competing priorities, go/no-go

Each role sees the full conversation and responds naturally — just like a real meeting.

## Step 3: Customize for Your Own Topic

To simulate a different discussion, edit the **Architect's prompt** to describe your proposal:

```yaml
- name: "Architect (Presenter)"
  prompt: |
    You are presenting a proposal to adopt event-driven architecture
    for our order processing pipeline.
    Current stack: REST APIs, PostgreSQL, 5 services.
```

You can also add more personas — a **Security Officer**, **UX Designer**, or **CFO** — just add them as roles.

## What You Got

- A realistic multi-role discussion with distinct, natural voices
- Objections and questions you might not have thought of
- A pattern you can reuse for any multi-stakeholder decision

## Next Steps

Learn [tool control](/tutorials/tool-control/) — choose the right tools to keep flows efficient.
