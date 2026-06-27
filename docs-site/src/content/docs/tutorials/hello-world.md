---
title: Hello, Flow
description: Understand what a flow is with a simple plan-then-edit pipeline
---

## What You'll Build

Your first flow. Two roles — a **Planner** who thinks through the approach and an **Editor** who executes it. In under 2 minutes, you'll understand the core idea: roles execute in sequence, each seeing the previous role's output.

## What Is a Flow?

A flow is a `.flow.yaml` file that defines a team of AI roles. Each role has a specific job, and they pass work between them automatically. You don't copy/paste — the output flows.

```
[Planner] → [Editor]
   plans      writes
```

That's it. Two roles. One file. No configuration needed.

## Step 1: Install the Example Flow

Open the flow gallery (`AI Flow: Open Flow Gallery` from the command palette), find **Hello, Flow**, and click **Install**. This copies `hello-world.flow.yaml` to `.github/flows/`.

Or run this in Copilot Chat:

```
@flow /install hello-world
```

## Step 2: Open the Flow File

Open `.github/flows/hello-world.flow.yaml`. Look at the structure:

<a href="vscode://feima.copilot-ai-flow/open?flow=hello-world">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=hello-world">🔧 Open in Insiders</a>

```yaml
roles:
  - name: "Planner"
    prompt: |
      You are a planning assistant...
  - name: "Editor"
    prompt: |
      You are an editor who turns plans into polished output...
```

Every flow has:
- **`name:`** — identifies the flow
- **`roles:`** — the team of AI roles, each with a `name` and `prompt`
- **`sharedContext:`** — documentation that helps users AND provides persistent context

The `prompt:` is the system instruction for that role — it defines what the role does and how it formats output.

## Step 3: Run It

```
@flow #file:.github/flows/hello-world.flow.yaml

Write a README for a TypeScript library that validates email addresses
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fhello-world.flow.yaml%0A%0AWrite%20a%20README%20for%20a%20TypeScript%20library%20that%20validates%20email%20addresses">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fhello-world.flow.yaml%0A%0AWrite%20a%20README%20for%20a%20TypeScript%20library%20that%20validates%20email%20addresses">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/hello-world.flow.yaml`</small>

<a href="../../assets/screenshots/hello-world.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/hello-world.png" alt="Hello, Flow output showing Planner plan and Editor final result" /></a>

Watch what happens:

1. **Planner** reads your query and produces a structured plan with numbered steps, dependencies, and pitfalls
2. **Editor** reads the plan and produces the final README

Each role sees the previous role's output automatically. No copy/paste needed.

## What You Got

- A structured plan (numbered steps, dependencies, watch-outs)
- A polished final output based on that plan
- Understanding of the core flow concept: `roles:` execute in sequence

## Next Steps

Now that you understand what a flow is, [learn the pipeline pattern](/tutorials/pipeline-basics/) with three specialized roles.
