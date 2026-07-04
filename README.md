# AI Flow — Multi-Agent Orchestration

**Define autonomous AI workflows. Version them like code. Get consistent, repeatable results.**

AI Flow adds `@flow` to your Copilot Chat — a participant that runs multi-role AI workflows defined in `.flow.yaml` files. Each role gets its own system prompt, tools, and context. Roles run autonomously through full tool-use loops, then hand off to the next role. The result: agents that work longer, stay on-task, and produce consistent output you can trust.

```yaml
# code-review.flow.yaml — owned by your team, versioned in your repo
name: Code Review
roles:
  - name: Logic & Correctness
    prompt: Review for logical errors, edge cases, and correctness.
    tools: [copilot_readFile, copilot_findTextInFiles]
  - name: Style & Security
    prompt: Review for code style violations and OWASP Top 10 security issues.
  - name: Verdict
    prompt: Synthesize findings into a prioritized, actionable review.
```

```bash
@flow #file:code-review.flow.yaml

Review the changes in src/auth/login.ts
```

---

## Why AI Flow?

Single-prompt chats hit a ceiling fast. You switch contexts, repeat yourself, lose thread. The model forgets constraints. Output drifts.

AI Flow gives you three things single-prompt chats can't:

| | | |
|---|---|---|
| **Control** | Every role, tool, and context is explicit in a `.flow.yaml` file you version alongside your code. Nothing is hidden. PR reviewers can read your orchestration logic. | |
| **Autonomy** | Roles run full tool-use loops — read files, search code, run terminals — without you babysitting. Long-running flows hand off to background agents via the Copilot SDK so you can keep working. | |
| **Consistency** | Progressive disclosure rendering ensures critical instructions always fit in the token window. The same flow produces structurally identical output every run. | |

[![Pipeline flow diagram](https://raw.githubusercontent.com/feimacode/feima-copilot-ai-flow/main/docs-site/public/assets/screenshots/pipeline-basics.png)](https://youtu.be/GjpuDjIUrGs)

---

## Orchestration Primitives

Three execution patterns — pick the one that matches your workflow structure.

### Pipeline (`roles:`)

Roles run in sequence. Each sees the output of every previous role. Best for multi-lens review, staged generation, synthesis workflows.

```
Security Reviewer  ──▶  Performance Reviewer  ──▶  Lead Engineer (Synthesis)
```

### Iterative (`stages:` + `iterations`)

Stages loop until quality converges. Set a max iteration count per stage. Best for refinement, editing passes, incremental improvement.

```yaml
stages:
  - name: Draft & Refine
    iterations: 3
    roles:
      - name: Writer
      - name: Critic
  - name: Final Polish
    iterations: 1
    roles:
      - name: Editor
```

### Fork-Join (`groups:` + `join:`)

Parallel investigations merged by a synthesizer. Best for incident triage, multi-perspective analysis.

```yaml
groups:
  - name: App Layer
    roles: [App Investigator]
  - name: Infra Layer
    roles: [Infra Investigator]
  - name: Data Layer
    roles: [Data Investigator]
join:
  name: Incident Commander
  prompt: Synthesize findings into a root-cause report.
```

---

## Autonomous Tool Use

Roles don't just chat — they act. Each role gets its own tool allowlist:

```yaml
tools:
  - copilot_readFile          # Read workspace files
  - copilot_findTextInFiles   # Search the codebase
  - copilot_runInTerminal     # Execute shell commands
  - copilot_listDir           # Browse directory structure
  # or "*" for all available tools
```

Roles autonomously decide which tools to call, run them, and incorporate results — up to 15 rounds per role. Omit `tools` for conversation-only roles.

For long-running flows, add `delegate: true` to a role. It hands off to a background agent via the GitHub Copilot SDK, freeing your chat session while the work completes.

---

## Smart Token Management

Prompt rendering uses **progressive disclosure** — lower-priority elements drop first when the token budget is tight, so critical instructions always survive:

| Priority | Content |
|---|---|
| 1000 | Role system instructions (never dropped) |
| 950 | Current user query |
| 900 | Workspace / editor context |
| 700 | Conversation history from prior roles |
| 600 | Attached context files (`#file:` + `contexts:`) |

This means your flows produce consistent output regardless of how much context you attach.

---

## Built-in Flow Library

Production-ready flows ship with the extension. Use them as-is or copy to your workspace and customize.

| Flow | Pattern | What It Does |
|------|---------|-------------|
| **Code Review** | Pipeline | Correctness, security, style — synthesized into a prioritized report |
| **PR Description** | Pipeline | Code Historian → Impact Assessor → PR Writer |
| **Story Estimation** | Pipeline | Product Owner → Dev Lead → QA Lead virtual scrum |
| **Backlog Ranking** | Pipeline | Multi-dimension priority ordering across value, risk, effort |
| **Test Writing** | Iterative | First pass: coverage. Second pass: adversarial edge-case hunting |
| **War-Room Triage** | Fork-Join | Parallel app/infra/data investigation → root-cause synthesis |
| **SDD Full Cycle** | Pipeline | Spec → Design → Implementation plan — full spec-driven development |
| **Dialog Simulator** | Iterative | Multi-turn conversation simulation with configurable personas |

![Flow gallery](https://raw.githubusercontent.com/feimacode/feima-copilot-ai-flow/main/docs-site/public/assets/screenshots/flow-gallery.png)

---

## Quick Start

```
@flow #file:code-review.flow.yaml

Review the changes in src/auth/login.ts
```

Three specialized reviewers run in sequence. You get a prioritized review.

**No configuration needed.** The built-in library is available immediately after install.

---

## Commands

| Command | |
|---|---|
| `@flow /browse` | Interactive gallery with flow previews and one-click install |
| `@flow /list` | All built-in flows grouped by category |
| `@flow /search <query>` | Find flows by name, tag, or category |
| `@flow /install <id>` | Copy a built-in flow to `.github/flows/` for customization |
| `@flow /create <description>` | Generate a `.flow.yaml` from natural language |
| `@flow /enhance <flow> <instruction>` | Modify an existing flow with new capabilities |
| `@flow /gallery` | Open the visual flow editor |
| `@flow /tutorial` | Built-in tutorials for flow authoring |

---

## Requirements

- **VS Code** 1.85+
- **GitHub Copilot Chat** (pre-installed in VS Code)
- **Feima Copilot More LLMs** (bundled extension pack — enhanced model selection)

---

## For Developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for build, architecture, and release instructions.
See [AGENTS.md](AGENTS.md) for the AI assistant reference.

---

## License

MIT
