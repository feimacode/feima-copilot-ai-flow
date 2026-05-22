<!-- ai-config:generated:core -->
# AGENTS.md — Copilot AI Flow

## Project Purpose

**Copilot AI Flow** is a VS Code extension that adds the `@flow` chat participant. It fills the orchestration gap in the AI agent equation (`Model + Harness`) by letting users define multi-role AI workflows as `.flow.yaml` files checked in alongside their code.

Key capabilities:
- Sequential and stage-based role orchestration with configurable iteration and convergence
- Token-budget-aware prompt rendering via `@vscode/prompt-tsx` (progressive disclosure)
- Explicit context injection — flow-defined `contexts:` and user `#file:` attachments, both surfaced as lower-priority prompt elements
- Full VS Code tool-execution loop (read files, search codebase, etc.)
- Built-in flow library browsable with `@flow /list`, `/search`, `/browse`, `/install`

---

## Source Layout

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

## Build & Test

```bash
npm run compile        # tsc + esbuild webview bundle → out/
npm test               # vitest run (unit specs: src/**/*.spec.ts)
npm run test:watch     # vitest watch mode
npm run lint           # eslint src/ --ext ts
```

- **Always run `npm run compile` after changes** and fix all TypeScript errors before testing or declaring work complete.
- Tests use a VS Code API shim (`src/test/vscode-shim.ts`) — do not call real VS Code APIs in unit tests.
- `npm run compile` runs both `tsc -p ./` and `node esbuild.webview.mjs`; both must pass.

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

### Flow File Format

`.flow.yaml` files are validated against `schemas/flow.schema.json`. Key fields:

```yaml
name: string
orchestration: sequence | cli
roles:
  - name: string
    prompt: string         # inline system prompt
    agent: string          # OR: name of .agent.md file in .github/agents/
    skills: [string]       # skill names or { path } objects
    contexts: [string]     # file paths or { path } objects
    model: string          # optional model override
stages:                    # optional — wraps roles in iterative loops
  - name: string
    iterations: number
    roles: [...]
contexts: [string]         # flow-level contexts, inherited by all roles
skills: [string]           # flow-level skills, inherited by all roles
tools: [string | "*"]
sharedContext: string      # inline text prepended to every role's context
```

---

## Coding Conventions

- **Indentation**: tabs (not spaces)
- **TypeScript**: strict mode; no `any` or `unknown` unless unavoidable; prefer `readonly` on all properties and arrays
- **Naming**: `PascalCase` for types/classes/enums; `camelCase` for functions, methods, variables
- **Strings**: double quotes for user-visible strings; single quotes for internal strings
- **Arrow functions**: preferred over `function` expressions for callbacks; do not wrap single parameters in parentheses (`x => x` not `(x) => x`)
- **Curly braces**: always required for `if`/`for`/`while` bodies; opening brace on same line
- **JSX factory**: `.tsx` files use `vscpp` / `vscppf` (not `React.createElement` / `React.Fragment`) — set by `tsconfig.json`; never import React in prompt components
- **Disposables**: register immediately after creation; use `DisposableStore` / `MutableDisposable` for objects created in repeated calls
- **No duplicate imports**: reuse existing import statements; remove the blank line when removing an import
- **No `instanceof vscode.Uri`**: use duck-typing (`'scheme' in v && 'path' in v`) — `instanceof` can fail across module boundaries in the extension host

---

## Key Interfaces

```typescript
// src/types/flowDocument.ts
IFlowConfig       // parsed .flow.yaml — the runtime config object
IFlowRole         // a single role: { name, prompt?, agent?, skills?, contexts?, model? }
IFlowStage        // a stage: { name, iterations, roles, skills?, contexts? }
IContextRef       // string | { path: string }
ISkillRef         // string | { path: string }
IAgentRef         // string | { path: string }

// src/context/flowContextBuilder.ts
IFlowContext      // { activeEditor?, workspace?, diagnostics?, references }

// src/prompts/flowPromptRenderer.ts
ContextFile       // { label: string; content: string }
```

---

## Adding a Built-in Flow

1. Create `src/flow/library/<id>.flow.yaml` (or register it in `FlowLibrary`).
2. Add the entry to the library manifest with `id`, `name`, `description`, `category`, `tags`, `difficulty`.
3. Run `npm run compile` to verify no schema violations.

---

## What to Avoid

- Do **not** inject context file content directly into the system prompt string — use `resolveContextFiles()` / `resolveReferenceFiles()` and pass `ContextFile[]` to `renderRolePrompt()`.
- Do **not** call `vscode.lm.selectChatModels()` inside prompt components — model selection belongs in `callRole()`.
- Do **not** add tool calls inside `buildAugmentedSystemPrompt()` — that method is synchronous except for file I/O and must stay focused on prompt assembly.
- Do **not** use `console.log` for user-facing output — use `stream.markdown()` or `stream.progress()`.
<!-- ai-config:end -->
