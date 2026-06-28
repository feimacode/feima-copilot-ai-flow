# Feima AI Flow — Developer Guide

Everything you need to build, test, release, and publish the `copilot-ai-flow` VS Code extension.

---

## Build & Test

```bash
npm install
npm run compile        # tsc + esbuild webview bundle → out/
npm test               # vitest run (unit specs: src/**/*.spec.ts)
npm run test:watch     # vitest watch mode
npm run lint           # eslint src/ --ext ts
```

- **Always run `npm run compile` after changes** and fix all TypeScript errors before testing or declaring work complete.
- Tests use a VS Code API shim (`src/test/vscode-shim.ts`) — do not call real VS Code APIs in unit tests.
- `npm run compile` runs both `tsc -p ./` and `node esbuild.webview.mjs`; both must pass.

---

## Project Structure

```
src/
  extension.ts              # Activation entry point — registers all participants/commands
  flow/
    flowParticipant.ts      # @flow chat participant — orchestrates all execution
    flowService.ts          # Parses and validates .flow.yaml files
    flowLibrary.ts          # Built-in library: load, search, install flows
  prompts/
    flowRolePrompt.tsx       # Prompt-TSX component: renders the full prompt for a role
    flowPromptRenderer.ts   # Wraps renderPrompt(); returns LanguageModelChatMessage[]
    flowTools.tsx           # Tool-call round TSX elements
    flowAuthoringSkill.tsx  # Prompt-TSX skill for @flow create / @flow enhance
  context/
    flowContextBuilder.ts   # Builds IFlowContext from a ChatRequest
  session/
    flowConversation.ts     # FlowTurn, FlowConversation, FlowConversationStore
  types/
    flowDocument.ts         # IFlowConfig, IFlowRole, IFlowStage, IContextRef, ISkillRef, IAgentRef
  util/
    toolSchemaNormalizer.ts # Normalises tool input schemas before sending to the model
    toolFilter.ts           # Smart tool filtering when tool count exceeds model limits
    copilotSdkExecutor.ts   # GitHub Copilot SDK delegation (cli orchestration mode)
  ui/                       # Webview panel (React + @xyflow/react for flow visualisation)
  commands/                 # VS Code command handlers
schemas/
  flow.schema.json          # JSON Schema for *.flow.yaml — used for editor validation
examples/                   # Example .flow.yaml files
src/test/
  vscode-shim.ts            # VS Code API mock for unit tests
  setup.ts                  # Vitest global setup
```

---

## Tech Stack

- **TypeScript** (strict mode) with tabs for indentation
- **Prompt-TSX** (`@vscode/prompt-tsx`) for prompt rendering
- **React + @xyflow/react** for the flow editor webview
- **Vitest** for unit testing
- **ESBuild** for webview bundling
- **js-yaml** for `.flow.yaml` parsing

---

## Architecture

### Prompt Rendering — Progressive Disclosure

Prompts are built with `@vscode/prompt-tsx`. The renderer drops lower-priority elements first when the token budget is tight. Priority ladder in `FlowRolePrompt`:

| Priority | Element |
|---|---|
| 1000 | Role system instructions (never dropped) |
| 950 | Current user query |
| 900 | VS Code editor / workspace context |
| 700 | Conversation history |
| 600 | Context files (`contexts:` + `#file:` attachments) |

Context files must **never** be concatenated directly into the system prompt string. Always pass them as `ContextFile[]` to `renderRolePrompt()` so the renderer can manage the budget.

### `@flow` Participant Flow

```
handleRequest()
  → findFlowFile()          # URI ref → history → name search → cached fallback
  → flowService.parsePrompt()
  → executeSequential() | executeStages() | executeCli()
      → buildAugmentedSystemPrompt()   # resolves agent file + injects skills
      → resolveContextFiles()          # flow-defined contexts:
      → resolveReferenceFiles()        # user #file: attachments
      → callRole()
          → promptRenderer.renderRolePrompt()   # prompt-tsx → messages[]
          → model.sendRequest()
          → tool execution loop (up to 15 rounds)
```

---

## Flow File Format Reference

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

## Releasing & Publishing

There are **two GitHub Actions workflows** that handle the release pipeline:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **Release** | `.github/workflows/release.yml` | Git tag push (`v*`) or manual dispatch | Build VSIX, generate checksum, create GitHub Release |
| **Publish to Marketplace** | `.github/workflows/publish-marketplace.yml` | Manual dispatch only | Download VSIX from a release, verify checksum, publish to VS Code Marketplace |

---

### Prerequisites — Required Secrets

Before publishing, ensure these secrets are set in the repository (**Settings → Secrets and variables → Actions**):

| Secret | Required by | How to get it |
|--------|-------------|---------------|
| `VSCE_PAT` | `publish-marketplace.yml` | [Azure DevOps PAT](https://dev.azure.com/feimacode/_usersSettings/tokens) with **Marketplace (Publish)** scope |

`GITHUB_TOKEN` is automatically provided by GitHub Actions — no configuration needed.

---

### Step-by-Step: Full Release & Publish

#### 1. Prepare the release

```bash
# 1a. Update CHANGELOG.md with changes since the last release
#     (follow Keep a Changelog format)

# 1b. Bump the version — this updates package.json, creates a git tag, and commits
npm version patch   # or minor / major

# 1c. Push the commit AND the tag
git push --follow-tags
```

#### 2. Wait for the Release workflow

Pushing a `v*` tag **automatically triggers** `.github/workflows/release.yml`. It runs three jobs:

| Job | What it does |
|-----|-------------|
| `validate` | Extracts version from tag, validates semver format, confirms it matches `package.json` |
| `build` | `npm ci` → `npm run compile` → fetches catalog index from `feima-harness-catalog` → packages VSIX → generates SHA-256 checksum → validates VSIX structure & size → uploads artifacts |
| `release` | Downloads artifacts, extracts the relevant section from `CHANGELOG.md`, creates a **GitHub Release** with the VSIX and `.sha256` file attached |

> **Manual trigger**: You can also run the Release workflow manually from **Actions → Release → Run workflow**. Enter a version (e.g. `0.1.1`) and optionally enable **Dry run** to build and validate without creating a release.

**What you get** — a GitHub Release with:
```
dist/
├── feima-copilot-ai-flow-{version}.vsix
└── feima-copilot-ai-flow-{version}.vsix.sha256
```

#### 3. Publish to the VS Code Marketplace

> ⚠️ **The Publish workflow MUST be triggered manually.** It will not run automatically after the Release.

1. Go to **Actions → Publish to Marketplace → Run workflow**
2. Fill in the form:
   - **Version**: the version to publish (e.g. `0.1.1`, without the `v` prefix)
   - **Confirmation**: type exactly `PUBLISH` (uppercase)
3. Click **Run workflow**

The workflow runs four jobs:

| Job | What it does |
|-----|-------------|
| `validate` | Checks the confirmation string is `PUBLISH`, validates semver format |
| `check-release` | Confirms the GitHub Release `v{version}` exists, verifies the VSIX is in its assets, checks `VSCE_PAT` secret is set |
| `download-and-publish` | Downloads the VSIX and checksum from the release → verifies SHA-256 → runs `vsce publish` to the Marketplace at `feima.copilot-ai-flow` |
| `summary` | Always runs (even on failure) — prints a success/failure summary to the Actions run page |

**After success**, the extension is live at:
```
https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow
```

---

### End-to-End Diagram

```
┌─────────────────────────────────────────────────────────┐
│  YOU (local)                                            │
│                                                         │
│  1. Update CHANGELOG.md                                 │
│  2. npm version patch                                   │
│  3. git push --follow-tags                             │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  release.yml (auto — triggered by v* tag)               │
│                                                         │
│  validate ──► build ──► release                         │
│    │            │          │                             │
│    │  • compile │          └─► GitHub Release            │
│    │  • catalog │              ├─ VSIX                   │
│    │  • vsix    │              └─ .sha256                │
│    │  • sha256  │                                        │
│    └─► check    │                                        │
└─────────────────────────────────────────────────────────┘
                           │
                           │ (manual trigger — YOU must go to Actions)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  publish-marketplace.yml (manual dispatch)              │
│                                                         │
│  validate ──► check-release ──► download-and-publish    │
│    │              │                    │                  │
│    │  "PUBLISH"   │  • release exists  │  • download     │
│    │  semver      │  • VSIX in assets  │  • verify sha   │
│    │              │  • VSCE_PAT set    │  • vsce publish │
│    │              │                    │                  │
│    └──────────────┴────────────────────┘                  │
│                                                         │
│  summary (always runs)                                  │
└─────────────────────────────────────────────────────────┘
```

---

### Build VSIX Locally (without GitHub Actions)

To test the full build pipeline on your machine:

```bash
npm run build:vsix
```

This runs `build/build.ts`, which does:
1. `tsc -p ./` + `node esbuild.webview.mjs` (compile)
2. Fetches the `feima-harness-catalog` index and validates it via `scripts/validate-index.js`
3. Packages the VSIX with `@vscode/vsce`
4. Generates a SHA-256 checksum
5. Validates VSIX structure (required files present) and size (< 5 MB)

> **💡 Why NOT `--no-dependencies`?** The extension uses `tsc` (not esbuild), so compiled `out/*.js`
> files have `require()` calls that need `node_modules/` at runtime. Instead of `--no-dependencies`,
> we use `.vscodeignore` to include only the three small runtime deps (~1.3 MB total):
> `js-yaml`, `argparse`, and `@vscode/prompt-tsx`. The 281 MB `@github/copilot` package is excluded —
> VS Code provides it at runtime via dynamic `import()`.

Output in `dist/`:
```
dist/
├── feima-copilot-ai-flow-{version}.vsix
└── feima-copilot-ai-flow-{version}.vsix.sha256
```

---

### Docs Site Deployment

The documentation site (`docs-site/`) auto-deploys to **GitHub Pages** at `flow-docs.feimacode.com` via `.github/workflows/docs-deploy.yml` on every push to `main` that touches `docs-site/**`.

```bash
cd docs-site
npm install
npm run dev      # http://localhost:4321
npm run build    # static site → docs-site/dist/
```

---

## Coding Conventions

- `PascalCase` for types/classes/enums; `camelCase` for functions, methods, variables
- Double quotes for user-visible strings; single quotes for internal
- Arrow functions preferred; no parentheses on single-parameter arrows
- Curly braces always required for `if`/`for`/`while` bodies
- Disposables registered immediately after creation via `DisposableStore`

See [AGENTS.md](AGENTS.md) for the full developer reference.

---

## License

MIT
