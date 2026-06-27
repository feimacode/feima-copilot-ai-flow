---
title: Tool Control
description: Choose explicit tool lists to keep flows efficient and prevent context window bloat
---

## What You'll Learn

Every tool a role has access to consumes context window space. By default, roles may get more tools than they need. Explicit `tools:` lists give you control — and keep flows fast and cheap.

## The Problem

Without `tools:`, roles may receive a large default tool set. If a role only needs to read files, giving it file creation, terminal access, and search tools wastes context window that could go to your actual content.

```
Default tools (maybe 10+)           Explicit tools (just 2)
─────────────────────────           ─────────────────────
copilot_readFile                    copilot_readFile
copilot_findTextInFiles             copilot_findTextInFiles
copilot_createFile    ← unused
copilot_replaceString ← unused
run_in_terminal       ← unused
vscode_askQuestions   ← unused
...                                  ↑ focused, efficient
```

## The Solution: Explicit `tools:`

List only the tools each role actually needs:

```yaml
# Flow-level — inherited by all roles
tools:
  - copilot_readFile

roles:
  - name: "Analyst"
    prompt: |
      Analyse the codebase...
    # Inherits flow-level tools: copilot_readFile

  - name: "Writer"
    prompt: |
      Write the implementation...
    tools:                          # role-level — extends flow-level
      - copilot_createFile
      - copilot_replaceString
```

- **Flow-level `tools:`** — inherited by all roles (unless a role has its own list)
- **Role-level `tools:`** — extends flow-level tools for that specific role

## Which Tools to Choose

| Task | Minimal Tools |
|------|--------------|
| Code review | `copilot_readFile`, `copilot_findTextInFiles` |
| Write code | `copilot_readFile`, `copilot_createFile`, `copilot_replaceString` |
| Investigation / search | `copilot_readFile`, `copilot_findTextInFiles` |
| File operations | `copilot_readFile`, `copilot_createFile`, `copilot_replaceString` |
| Terminal / build | `run_in_terminal`, `get_terminal_output` |
| Human gate | `vscode_askQuestions` |

## Practice: Add Tools to Your Flows

<a href="../../assets/screenshots/tool-control-add-tools.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/tool-control-add-tools.png" alt="Adding explicit tools: list to a flow YAML and running it" /></a>

Open `.github/flows/hello-world.flow.yaml` from the first tutorial. It has no `tools:`. Add this before `roles:`:

<a href="vscode://feima.copilot-ai-flow/open?flow=hello-world">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=hello-world">🔧 Open in Insiders</a>

```yaml
tools:
  - copilot_readFile

roles:
  ...
```

Now the Planner and Editor can read files. Run it again — the output may reference actual project files.

For the pipeline flow, open `.github/flows/01-pipeline-review.flow.yaml` and add:

```yaml
tools:
  - copilot_readFile
  - copilot_findTextInFiles
```

Now the Analyst can search your codebase, making the review grounded in actual code.

## Tool Count Is a Design Decision

| Flow | Tools | Context cost | Best for |
|------|-------|-------------|----------|
| `code-review` | 2 | Low | Quick reviews |
| `backlog-ranking` | 2 | Low | Sprint planning |
| `test-writing` | 4 | Medium | Comprehensive testing |
| `war-room-triage` | 5 | High | Incident response (worth it) |
| `sdd-openspec-full-cycle` | 7 | High | Full-cycle (needs all of them) |

Start small. Add tools when you need them — not before.

## What You Got

- Understanding that tool count impacts context window
- Ability to choose minimal tool sets per role
- Practice adding tools to existing flows

## Next Steps

Learn the [human gate](/tutorials/human-gate/) pattern — collect structured user input before execution.
