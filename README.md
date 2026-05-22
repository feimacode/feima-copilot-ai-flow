# Copilot AI Flow

The AI agent equation is converging on **Model + Harness**. The ecosystem has delivered strong harness primitives — tools, skills, MCPs, hooks, custom agents — yet one piece remains largely missing: **Orchestration**. How do you sequence multiple AI roles, manage context budgets across them, iterate until a result converges, and hand off to autonomous execution when ready?

That gap is what AI Flow is built to close.

> Expert panel discussions (the original AI Panel) are fully supported as one orchestration pattern among several.

## Use Cases

**Full control over agent execution** — Define exactly which roles run, in what order, with what tools and context. No black-box prompting; the flow is a versioned YAML file you own and review.

**Idea to execution in a single prompt** — Capture a complete workflow (spec → plan → implement → review) as a flow file. Invoke it with one line; the orchestrator handles the rest.

**Mitigating context rot** — Explicitly declare which tools and files each role sees. Roles only receive what they need, keeping prompts focused and preventing the model from drifting on irrelevant noise accumulated across a long session.

**Persistent reference context** — Embed design guidelines, architectural principles, security guardrails, or ADRs directly in the flow via `contexts:`. They load automatically for every role on every invocation — no need to re-attach them each time.

**Multi-perspective review** — Run the same artefact through a security reviewer, a performance reviewer, and a synthesis role in a single command. Each role sees prior output and builds on it.

**Iterative refinement** — Use stages with `iterations` to let roles loop until a convergence sentinel (`<!-- flow:done -->`) is emitted, replacing manual back-and-forth.

**Autonomous background execution** — Switch to `orchestration: cli` to hand off to the GitHub Copilot SDK for long-running or unattended tasks, with optional worktree isolation.

## Features

- 🔀 **Flow Orchestration**: Run roles sequentially, in stages with iteration, or delegate to the GitHub Copilot SDK (`cli` mode)
- 🎭 **Multi-Role Discussions**: Simulate expert panels with distinct perspectives — architect, reviewer, critic, and more
- 📎 **Context Injection**: Attach reference files (`#file:` or flow `contexts:`) injected at a lower priority so the token budget is never wasted
- 🧠 **Progressive Disclosure**: Token-budget-aware prompt rendering drops low-priority content gracefully when context is large
- 🛠️ **Tool Use**: Roles can call VS Code tools (read files, search codebase, etc.) with a full tool-execution loop
- 📚 **Flow Library**: Built-in collection of flows for SDD, code review, sprint planning, and more (`@flow /list`)
- 🔍 **Discoverable**: `@flow /search <query>` and `@flow /install <id>` to find and copy flows to your workspace
- ⚙️ **Customizable**: Author flows as `.flow.yaml` files checked in alongside your code

## Quick Start

1. Install the extension
2. Reference a flow file in chat:
   ```
   @flow #file:.github/flows/sdd-spec-kit.flow.yaml What should we build?
   ```
3. Or search the built-in library:
   ```
   @flow /search sprint planning
   @flow /install sdd-spec-kit
   ```
4. Or just name the flow — the extension searches `.github/flows/` automatically:
   ```
   @flow sdd-spec-kit What should we build?
   ```

## Orchestration Modes

| Mode | Description |
|---|---|
| `sequence` | Roles respond one after another, each seeing prior output |
| `sequence` + `stages` | Stages loop up to N iterations; exits early on `<!-- flow:done -->` sentinel |
| `cli` | Delegates to the GitHub Copilot SDK for background/autonomous execution |

## Flow File Format

Create a `.flow.yaml` file (conventionally in `.github/flows/`):

```yaml
name: Architecture Review
description: Expert review from multiple engineering perspectives
orchestration: sequence
contexts:
  - docs/architecture.md       # injected as lower-priority context for all roles
  - docs/adr/                  # directory of ADRs
tools:
  - copilot_readFile
  - copilot_searchCodebase
  # Use "*" to include all available VS Code tools
roles:
  - name: Security Reviewer
    prompt: You are a security-focused architect. Review for OWASP Top 10 risks.
  - name: Performance Reviewer
    prompt: You are a performance engineer. Identify bottlenecks and scalability concerns.
  - name: Synthesis
    prompt: You are a lead engineer. Summarise the findings and propose an action plan.
```

### Context Files

The `contexts` field (available at flow, stage, and role level) accepts file paths relative to the flow file or the workspace root:

```yaml
contexts:
  - path: docs/spec.md        # explicit object form
  - CONTRIBUTING.md           # bare string — resolved relative to flow file first
```

Users can also attach files directly in the chat input (`#file:` or drag-and-drop). Those files are automatically included as context for every role in the flow, with the flow file itself excluded.

### Tools Configuration

```yaml
tools:
  - copilot_readFile           # specific tools
  - copilot_searchCodebase
  - "*"                        # OR: wildcard includes all available tools
```

Omit `tools` (or use an empty array) for conversation-only mode.

## Built-in Library Commands

| Command | Description |
|---|---|
| `@flow /list` | List all built-in flows grouped by category |
| `@flow /search <query>` | Filter by name, tag, or category |
| `@flow /browse` | Full gallery with metadata |
| `@flow /install <id>` | Copy a flow to `.github/flows/` in your workspace |

## VS Code Commands

- `AI Flow: Open Flow Gallery` — browse built-in flows
- `AI Flow: List Available Tools` — see registered VS Code tools

## Categories

- **Software Development**: SDD full cycle, spec-kit, codebase exploration
- **Business & Strategy**: Product strategy, market analysis, prioritisation
- **Design & UX**: Design critiques, accessibility audits
- **Education**: Tutoring, concept exploration
- **Creative**: Brainstorming, story development
- **Operations**: Incident postmortems, capacity planning

## License

MIT

