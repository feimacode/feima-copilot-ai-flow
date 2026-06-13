# Copilot AI Flow

**Orchestrate multiple AI roles in a single command.** Define a team of specialized reviewers, planners, or investigators — each with their own perspective, tools, and context — and let them work together on your task. All in a versioned YAML file you own.

> 🚀 **[Run your first flow in 60 seconds →](#quick-start)**

---

## Quick Start

```bash
@flow #file:code-review.flow.yaml

Review the changes in src/auth/login.ts
```

That's it. The flow runs three specialized reviewers — Logic & Correctness, Style & Security, and a Verdict synthesizer — each building on the previous output. You get a prioritized review with actionable findings.

**No setup, no configuration.** The built-in library has flows ready to run:

| Flow | What It Does | Try It |
|------|-------------|--------|
| **Code Review** | Multi-lens review: correctness, security, style | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Acode-review.flow.yaml%0A%0AReview%20the%20changes%20in%20) |
| **PR Description** | Auto-generate PR descriptions from your diff | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Apr-description.flow.yaml%0A%0AGenerate%20a%20PR%20description%20for%20this%20branch) |
| **Story Estimation** | Virtual scrum team sizes your stories | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Astory-estimation.flow.yaml%0A%0AStory%3A%20Add%20user%20authentication%20with%20JWT) |
| **Backlog Ranking** | Multi-dimension priority ordering | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Abacklog-ranking.flow.yaml%0A%0AHere%27s%20our%20backlog%3A) |
| **Test Writing** | Generate tests with adversarial edge case hunting | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Atest-writing.flow.yaml%0A%0AWrite%20tests%20for%20) |
| **War-Room Triage** | Incident response with parallel investigation | [Run in Copilot](vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3Awar-room-triage.flow.yaml%0A%0AWe%20have%20an%20incident%3A) |

Click any "Run in Copilot" button to open VS Code with the command pre-filled. Or browse all flows with `@flow /browse`.

---

## What You Can Do

### 🔍 Multi-Perspective Review
Run the same code through a security reviewer, a performance reviewer, and a synthesis role in one command. Each role sees prior output and builds on it — no more switching contexts between separate prompts.

### 📋 Sprint Planning, Automated
Estimate stories with a virtual scrum team (Product Owner, Dev Lead, QA Lead, and more). Rank your backlog across business value, technical risk, dependencies, and effort. Two flows that cover your full planning loop.

### 🚨 Incident Response Under Pressure
Paste an alert. The flow runs parallel investigations across application, infrastructure, and data layers — then synthesizes findings. No more HiPPO-driven debugging.

### 📝 PR Descriptions That Don't Suck
Feed it your diff. The Code Historian figures out intent, the Impact Assessor finds breaking changes, and the PR Writer composes a description reviewers actually want to read.

### 🧪 Tests That Catch Edge Cases
Generate tests with an adversarial Edge Case Hunter that finds gaps the first pass misses. Consistently better coverage than single-prompt generation.

### 🔄 Iterative Refinement
Wrap roles in stages with `iterations` to loop until a convergence sentinel is emitted. Replace manual back-and-forth with automated iteration.

### 🤖 Autonomous Background Execution
Hand off long-running flows to the GitHub Copilot SDK for unattended execution with optional worktree isolation.

---

## Features

- 🔀 **Flow Orchestration**: Pipeline, staged iteration, or fork-join — choose the pattern that fits
- 🎭 **Multi-Role Discussions**: Each role has its own system prompt, tools, and context
- 📎 **Context Injection**: Attach files via `#file:` or flow `contexts:` — injected at lower priority so the token budget is never wasted
- 🧠 **Progressive Disclosure**: Token-budget-aware rendering drops low-priority content gracefully
- 🛠️ **Tool Use**: Roles call VS Code tools (read files, search codebase, run terminals) with a full tool-execution loop
- 📚 **Built-in Library**: Production flows for code review, sprint planning, incident response, and more
- 🔍 **Discoverable**: `@flow /search <query>` and `@flow /install <id>` to find and copy flows

---

## Flow File Format

Flows are `.flow.yaml` files — versioned, reviewable, and checked in alongside your code:

```yaml
name: Architecture Review
description: Expert review from multiple engineering perspectives
category: "software-development"
difficulty: "beginner"
tools:
  - copilot_readFile
  - copilot_findTextInFiles

roles:
  - name: Security Reviewer
    prompt: |
      You are a security-focused architect. Review for OWASP Top 10 risks.
      Output findings with severity, location, and remediation.

  - name: Performance Reviewer
    prompt: |
      You are a performance engineer. Identify bottlenecks and scalability concerns.
      Output findings with impact assessment and optimization suggestions.

  - name: Synthesis
    prompt: |
      You are a lead engineer. Synthesize all findings into a prioritized action plan.
      Include effort estimates and risk ratings for each recommendation.
```

### Execution Patterns

| Pattern | YAML Key | Behavior |
|---------|----------|----------|
| **Pipeline** | `roles:` | Sequential — each role sees prior output |
| **Iterative** | `stages:` | Loop up to N iterations, exit on `<!-- flow:done -->` |
| **Fork-Join** | `groups:` + `join:` | Parallel branches merged by a join role |

### Context & Tools

```yaml
contexts:
  - docs/architecture.md       # injected as lower-priority context for all roles
  - docs/adr/                  # directory of ADRs

tools:
  - copilot_readFile           # specific tools
  - copilot_findTextInFiles
  - "*"                        # OR: wildcard for all available tools
```

Omit `tools` for conversation-only mode. Context files can also be attached in chat via `#file:` or drag-and-drop.

---

## Built-in Library

| Command | Description |
|---|---|
| `@flow /list` | List all built-in flows grouped by category |
| `@flow /search <query>` | Filter by name, tag, or category |
| `@flow /browse` | Full gallery with metadata and preview |
| `@flow /install <id>` | Copy a flow to `.github/flows/` in your workspace |

### Categories

- **Software Development**: Code review, PR descriptions, test writing, SDD full cycle
- **Planning**: Story estimation, backlog ranking
- **Operations**: Incident triage, war-room response
- **Design & UX**: Design critiques, accessibility audits
- **Education**: Tutoring, concept exploration
- **Creative**: Brainstorming, story development

---

## For Developers

### Build & Test

```bash
npm install
npm run compile        # tsc + esbuild webview bundle → out/
npm test               # vitest run (unit specs: src/**/*.spec.ts)
npm run test:watch     # vitest watch mode
npm run lint           # eslint src/ --ext ts
```

### Project Structure

```
src/
  extension.ts              # Activation entry point
  flow/                     # Flow participant, service, library
  prompts/                  # Prompt-TSX components
  context/                  # Context resolution
  types/                    # IFlowConfig, IFlowRole, IFlowStage
  util/                     # Tool normalization, filtering
  ui/                       # Webview panels (React + @xyflow/react)
  commands/                 # VS Code command handlers
schemas/
  flow.schema.json          # JSON Schema for *.flow.yaml validation
examples/                   # Example .flow.yaml files
src/docs/                   # Internal docs (architecture, roadmap, engine reference)
docs-site/                  # User-facing documentation site (Astro + Starlight)
```

### Tech Stack

- **TypeScript** (strict mode) with tabs for indentation
- **Prompt-TSX** (`@vscode/prompt-tsx`) for prompt rendering
- **React + @xyflow/react** for the flow editor webview
- **Vitest** for unit testing
- **ESBuild** for webview bundling

### Documentation Site

A user-facing documentation site is available in `docs-site/`:

```bash
cd docs-site
npm install
npm run dev      # Local development server at http://localhost:4321
npm run build    # Build static site to docs-site/dist/
npm run preview  # Preview built site locally
```

**Deployment**: The site automatically deploys to GitHub Pages via the `.github/workflows/docs-deploy.yml` workflow on pushes to `main` that affect `docs-site/`.

**Content**: Tutorials, guides, and reference documentation for users. Engine-internal docs remain in `src/docs/` for contributors.

### Releasing & Publishing

#### Build VSIX locally

```bash
npm run build:vsix
```

This compiles the extension, packages a VSIX into `dist/`, generates a SHA-256 checksum, and validates the output. The resulting files:

```
dist/
├── feima-copilot-ai-flow-{version}.vsix
└── feima-copilot-ai-flow-{version}.vsix.sha256
```

#### Release to GitHub

The release pipeline is **tag-triggered**. To create a new release:

1. Bump the version and update `CHANGELOG.md`:

```bash
npm version patch  # or minor / major
```

This updates `package.json`, creates a git tag, and commits. Push with the tag:

```bash
git push --follow-tags
```

The `.github/workflows/release.yml` workflow will:
- Validate the version matches `package.json`
- Compile and package the VSIX
- Generate a SHA-256 checksum
- Create a GitHub Release with the VSIX and checksum attached

You can also trigger the workflow manually via the **Actions → Release → Run workflow** with a version input.

#### Publish to Marketplace

After a GitHub Release exists, publish to the VS Code Marketplace:

1. Go to **Actions → Publish to Marketplace → Run workflow**
2. Enter the version (e.g., `0.1.0`)
3. Type `PUBLISH` as the confirmation string

The `.github/workflows/publish-marketplace.yml` workflow will:
- Verify the GitHub Release and VSIX exist
- Download the VSIX and verify its checksum
- Publish to the VS Code Marketplace at `feima.copilot-ai-flow`

**Requires**: A `VSCE_PAT` secret configured in the repository (Azure DevOps personal access token with Marketplace publish scope).

#### End-to-End Flow

```
git tag vX.Y.Z → git push origin vX.Y.Z
        │
        ▼
  release.yml (auto)
        │
        ├─ validate version
        ├─ compile + package
        ├─ checksum
        └─ GitHub Release
                │
                │ (manual trigger)
                ▼
  publish-marketplace.yml
        │
        ├─ download VSIX
        ├─ verify checksum
        └─ vsce publish → Marketplace
```

### Coding Conventions

- `PascalCase` for types/classes/enums; `camelCase` for functions, methods, variables
- Double quotes for user-visible strings; single quotes for internal
- Arrow functions preferred; no parentheses on single-parameter arrows
- Curly braces always required for `if`/`for`/`while` bodies
- Disposables registered immediately after creation via `DisposableStore`

See [AGENTS.md](AGENTS.md) for the full developer reference.

---

## License

MIT
