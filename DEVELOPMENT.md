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

### Build VSIX locally

```bash
npm run build:vsix
```

This compiles the extension, packages a VSIX into `dist/`, generates a SHA-256 checksum, and validates the output. The resulting files:

```
dist/
├── feima-copilot-ai-flow-{version}.vsix
└── feima-copilot-ai-flow-{version}.vsix.sha256
```

### Release to GitHub

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

### Publish to Marketplace

After a GitHub Release exists, publish to the VS Code Marketplace:

1. Go to **Actions → Publish to Marketplace → Run workflow**
2. Enter the version (e.g., `0.1.0`)
3. Type `PUBLISH` as the confirmation string

The `.github/workflows/publish-marketplace.yml` workflow will:
- Verify the GitHub Release and VSIX exist
- Download the VSIX and verify its checksum
- Publish to the VS Code Marketplace at `feima.copilot-ai-flow`

**Requires**: A `VSCE_PAT` secret configured in the repository (Azure DevOps personal access token with Marketplace publish scope).

### End-to-End Flow

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

---

## Documentation Site

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
