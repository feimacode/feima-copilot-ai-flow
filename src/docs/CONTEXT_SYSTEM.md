# Context System: Instructions, Hooks, and Memory

Deep-dive into who owns loading and executing each context mechanism, with
implications for the panel extension.

---

## 1. Instructions (`.instructions.md`)

### Ownership: VS Code core

The entire pipeline lives in `vs/workbench/contrib/chat/common/`:

```
chatWidget.ts  (always passes instructionContext)
    └─► chatServiceImpl.sendRequest()
            └─► ComputeAutomaticInstructions.collect()     ← VS Code core
                    ├─► promptsService.getInstructionFiles()
                    ├─► addApplyingInstructions()           ← applyTo glob matching
                    ├─► _addReferencedInstructions()        ← transitive file refs
                    └─► _addAgentInstructions()             ← copilot-instructions.md, AGENTS.md
            └─► instructionEntries merged into IChatAgentRequest.variables
```

**File locations scanned** (from `promptFileLocations.ts`):

| Path | Scope |
|---|---|
| `.github/instructions/*.instructions.md` | Workspace |
| `.claude/rules/**/*.md` | Workspace (Claude compat) |
| `~/.copilot/instructions/` | User (personal) |
| `~/.claude/rules/` | User (Claude personal) |

**`applyTo` glob matching** happens in `ComputeAutomaticInstructions` before the
participant is invoked. A file with `applyTo: **/*.ts` is included only when the
attached context contains a `.ts` file.

**What participants receive**: `request.variables` contains the pre-collected
instruction entries as `IPromptTextVariableEntry` objects with
`automaticallyAdded: true`. Every participant — built-in and custom — receives
the same pre-collected set.

### Panel extension gap

`PanelParticipant.handleRequest()` reads `request.references` but ignores
`request.variables`. The auto-collected `.instructions.md` entries sit in
`request.variables` and are silently dropped.

**Fix needed**: `buildContext()` or `buildAugmentedSystemPrompt()` must scan
`request.variables` for `isPromptTextVariableEntry` entries where
`automaticallyAdded === true` and append their text to the role's system prompt.

```typescript
// Pseudocode for the fix
const autoInstructions = request.variables
    .filter(v => isPromptTextVariableEntry(v) && v.automaticallyAdded)
    .map(v => v.text)
    .join('\n\n');

// Prepend to basePrompt in buildAugmentedSystemPrompt()
if (autoInstructions) {
    basePrompt = `${autoInstructions}\n\n---\n\n${basePrompt}`;
}
```

---

## 2. Hooks (`.github/hooks/`)

### Ownership: split between VS Code core (loading) and agentHost (execution)

#### Phase 1 — Collection (VS Code core, `chatServiceImpl.ts`)

```
chatServiceImpl.sendRequest()
    └─► collectHooks()
            ├─► promptsService.listPromptFiles(PromptsType.hook)
            │       reads .github/hooks/*.json
            │            .claude/settings.json
            │            ~/.copilot/hooks/
            └─► normalises to ChatRequestHooks (keyed by HookType enum)
                    → IChatAgentRequest.hooks
                    → IChatAgentRequest.hasHooksEnabled
```

**Hook types** (`hookTypes.ts`):

| Type | Trigger |
|---|---|
| `SessionStart` | New agent session begins |
| `UserPromptSubmit` | User submits a prompt |
| `PreToolUse` | Before any tool call |
| `PostToolUse` | After a tool call completes |
| `Stop` | Agent session stops |
| `SubagentStart/Stop` | Subagent lifecycle |
| `PreCompact` | Before context compaction |

Format compatibility layers exist for VS Code JSON format, Claude
`settings.json` format, and GitHub Copilot CLI format — all normalised to the
same `HookType` enum.

#### Phase 2 — Execution (agentHost — VS Code core, SDK sessions only)

```
IChatAgentRequest.hooks → Copilot agentHost Node process
    └─► copilotPluginConverters.ts
            ├─► PreToolUse commands → copilotAgentSession._handlePreToolUse()
            │       └─► executeHookCommand()   ← spawn('/bin/sh', ['-c', cmd])
            └─► PostToolUse commands → _handlePostToolUse()
                    └─► executeHookCommand()   ← stdout piped back as tool context
```

`executeHookCommand()` is a plain `child_process.spawn` call running in the
agentHost process. It passes tool name + args as JSON on stdin and captures
stdout. This is VS Code core infrastructure — it runs regardless of which
extension initiated the request.

#### Phase 2 alternative — LLM-based sessions (Copilot Chat extension)

For non-SDK sessions, the Copilot Chat extension reads `request.hooks` and
threads them into the Claude SDK session or Copilot CLI session it spawns. The
hook execution then happens inside those external processes.

### Panel extension gap

`PanelParticipant.callRole()` calls `model.sendRequest()` directly — a pure LLM
call. No agentHost, no SDK session, no CLI session. The `request.hooks` object
**reaches the participant but is never used**. `PreToolUse` and `PostToolUse`
hooks silently do not fire.

**Fix needed**: The tool execution loop in `callRole()` must check
`request.hooks` and fire hook commands around each tool call:

```typescript
// In callRole(), around tool execution:
if (request.hooks?.PreToolUse?.length) {
    const stdin = JSON.stringify({ toolName: tc.name, toolArgs: tc.input });
    const output = await executeHookCommand(preToolHook, stdin); // shell spawn
    // output can inject additional context or block execution
}
// ... execute tool ...
if (request.hooks?.PostToolUse?.length) {
    await executeHookCommand(postToolHook, JSON.stringify(result));
}
```

This requires implementing `executeHookCommand()` in the extension (shell spawn),
since the agentHost version is not accessible from the extension host.

---

## 3. Memory (`/memories/`, `copilot_memory` tool)

### Ownership: Copilot Chat extension — NOT VS Code core

Memory is **not** part of the VS Code chat platform. The storage, tool
registration, and prompt injection are all owned by the Copilot Chat extension.

#### Two parallel systems

| System | Config key | Backend |
|---|---|---|
| File-based memory | `MemoryToolEnabled` (experiment) | `globalStorageUri/memory-tool/memories/` |
| CAPI memory | `chat.copilotMemory.enabled` | Cloud API (`agentMemoryService`) |

#### Storage path reality

The `/memories/` namespace is **virtual** — it is not a real filesystem path
under `~` or the workspace root. The tool routes it to VS Code extension storage:

| Scope | Virtual path | Actual storage |
|---|---|---|
| User | `/memories/*.md` | `extensionContext.globalStorageUri/memory-tool/memories/` |
| Session | `/memories/session/*.md` | `extensionContext.storageUri/memory-tool/memories/<sessionId>/` |
| Repository | `/memories/repo/*.md` | `extensionContext.storageUri/memory-tool/memories/repo/` |

`globalStorageUri` is Copilot Chat's own global storage — e.g.
`~/.vscode-server-insiders/data/User/globalStorage/github.copilot-chat/...`.
You cannot access it with a plain `fs.readFile('/memories/foo.md')`.

#### Reading memory into prompts (Copilot Chat only)

```
Copilot Chat agentPrompt.tsx
    └─► <MemoryContextPrompt sessionResource=... />    ← rendered only here
            ├─► getUserMemoryContent()     ← first MAX_USER_MEMORY_LINES of user memory
            ├─► getSessionMemoryFiles()    ← lists session files (not loaded)
            ├─► getLocalRepoMemoryFiles()  ← reads repo memory files
            └─► injected as UserMessage in the Prompt-TSX render tree (new chat only)
```

`MemoryContextPrompt` is rendered in `agentPrompt.tsx`, only when
`isNewChat === true`. It is **not** in `request.variables`. VS Code core has no
knowledge of the `/memories/` directory. Custom participants receive nothing
automatically.

The `copilot_memory` reference in VS Code core
(`chatArtifactExtraction.ts:17`) is only for rendering memory-write tool calls
as UI artifacts in the chat response panel.

#### Writing memory — YES, any extension can do this

`MemoryTool` is registered via `vscode.lm.registerTool('copilot_memory', tool)`.
It is declared in `package.json` as a `languageModelTools` contribution with
`"toolReferenceName": "memory"`. There is **no caller restriction** — no
trusted-callers list, no participant-ID check in `invoke()`.

Any extension can write (and read) memory by calling:

```typescript
await vscode.lm.invokeTool('copilot_memory', {
    input: { command: 'create', path: '/memories/panel-notes.md', file_text: '...' },
    toolInvocationToken: token,   // from the chat request token
});
```

The gating condition is `"when": "config.github.copilot.chat.tools.memory.enabled"` —
the Copilot Chat extension must be installed and the experiment flag on, but no
per-caller restrictions exist.

**All six commands are available**: `view`, `create`, `str_replace`, `insert`,
`delete`, `rename`. Repo scope restricts to `create` only.

#### Memory scopes (auto-loaded vs. on-demand)

| Scope | Auto-loaded into prompt | Writable via tool |
|---|---|---|
| User `/memories/` | ✅ First `MAX_USER_MEMORY_LINES` lines (Copilot Chat only) | ✅ Any extension |
| Session `/memories/session/` | ❌ Listed but not loaded | ✅ Any extension |
| Repository `/memories/repo/` | ✅ Recent entries (Copilot Chat only) | ✅ Any extension (`create` only) |

### Panel extension gap

The panel can **write** memory today by calling `vscode.lm.invokeTool`. The only
gap is **reading** — memory is not auto-injected into the panel's system prompt.

**Fix options** (in order of complexity):

**Option A — Read via `vscode.lm.invokeTool` before building system prompt**:
```typescript
// In handleRequest(), before buildAugmentedSystemPrompt():
const memoryResult = await vscode.lm.invokeTool('copilot_memory', {
    input: { command: 'view', path: '/memories/' },
    toolInvocationToken: request.toolInvocationToken,
});
const userMemory = extractText(memoryResult); // first N lines from listing
```
No filesystem access needed — uses the same virtual path the model uses.

**Option B — Expose a `memory: true` flag in panel YAML**:
```yaml
# panel.yaml
memory:
  user: true       # inject user memory into system prompt
  repo: true       # inject repo memory into system prompt
  session: false   # list only (don't auto-load)
```

**Option C — Let the model call the tool itself**:
Include `copilot_memory` in the tool list passed to `model.sendRequest()`. The
model will call it when it judges memory is relevant. Write-back works
automatically this way.

---

## Summary table

| Mechanism | Loaded by | Executed by | In `request.*` | Panel receives it | Panel uses it |
|---|---|---|---|---|---|
| `.instructions.md` | VS Code core | VS Code core | `request.variables` ✅ | ✅ yes | ❌ no — dropped |
| Hooks (`.github/hooks/`) | VS Code core | agentHost (SDK only) | `request.hooks` ✅ | ✅ yes (field exists) | ❌ no — ignored |
| Memory — **read** (prompt injection) | Copilot Chat ext | n/a | ❌ not in request | ❌ no | ❌ no |
| Memory — **write** (`copilot_memory` tool) | Copilot Chat ext (registered) | any extension | n/a | ✅ callable | ❌ not called |
| Skills (`SKILL.md`) | Panel extension | n/a (prompt injection) | n/a | ✅ yes | ✅ yes |
| Agents (`.agent.md`) | Panel extension | n/a (prompt injection) | n/a | ✅ yes | ✅ yes |

---

## Prioritised enhancement backlog

### High — already in `request` but unused

1. **Auto-instructions pass-through**: scan `request.variables` for
   `isPromptTextVariableEntry && automaticallyAdded` and prepend their text to
   each role's system prompt. This makes `applyTo`-scoped instructions work
   transparently with panel roles.

### Medium — requires shell execution in extension

2. **`PreToolUse` / `PostToolUse` hook execution**: implement
   `executeHookCommand()` (child_process spawn) in the extension and fire it
   around each tool call in `callRole()`'s tool execution loop. Reads from
   `request.hooks` which VS Code already populates.

### Medium — file I/O, explicit opt-in

3. **Memory read injection**: call `vscode.lm.invokeTool('copilot_memory', { command: 'view', path: '/memories/' })` before building the system prompt, then append the content. Use a `memory: true` flag in panel YAML to opt in. Writing already works — panels can include `copilot_memory` in their tool list and the model will write memory naturally during a turn.

4. **Memory write on role completion**: after each role completes, optionally call `vscode.lm.invokeTool('copilot_memory', { command: 'create', path: '/memories/session/panel-<role>.md', file_text: response })` to persist summaries across panel runs.

### Lower — schema and tooling

4. **Panel-level `instructions:` field**: allow panels to declare additional
   `.instructions.md` files by path or name to augment beyond what VS Code
   auto-collects (e.g., `instructions: [typescript-standards]`).

5. **`hooks:` at stage level**: allow a stage to declare which hook types to
   fire, enabling selective hook application per stage rather than
   workspace-wide.
