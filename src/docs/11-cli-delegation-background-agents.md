# Fork-Join and CLI Delegation Architecture

## Overview

This document describes the fork-join execution pattern and the `delegate: true` role annotation for routing execution through the GitHub Copilot CLI/SDK.

### `delegate: true` — SDK Delegation

Setting `delegate: true` on a role routes its execution through the **GitHub Copilot SDK** (background agent CLI) instead of the VS Code Language Model API. This replaces the former `orchestration: cli` flow-level setting.

```yaml
roles:
  - name: Implementer
    agent: .github/agents/coder.agent.md
    delegate: true    # routes via Copilot SDK
  - name: Reviewer
    prompt: Review the implementation.
    # default: routes via VS Code LM API
```

`delegate` is orthogonal to `agent:`:
- **`agent:`** controls the *content source* (where the system prompt comes from)
- **`delegate:`** controls the *execution path* (VS Code LM API vs. Copilot SDK)

### Fork-Join Pattern (`groups:` + `join:`)

### Key Features

- **Fork-Join Pattern**: Multiple groups work independently, then a `join` role synthesises their outputs
- **Worktree Isolation**: Per-group optional isolation in separate Git worktrees
- **Model Selection**: Per-group and per-role model configuration with flow-level fallback
- **Custom Agents**: Support for specialised agent personas and behaviours
- **Group-Level Skills & Contexts**: Each group can declare its own skills and context files

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Core                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Chat View & Sessions UI                           │     │
│  │  - AgentSessionsModel (session list)               │     │
│  │  - ChatSessionsService (provider registry)         │     │
│  │  - MainThreadChatSessions (RPC bridge)             │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↕ RPC                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Extension Host (VS Code Process)                  │     │
│  │  - chatSessionsProvider API v3                     │     │
│  │  - IChatSessionItemProvider                        │     │
│  │  - IChatSessionContentProvider                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│            Copilot Chat Extension                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ChatSessionsContrib (Registration)                │     │
│  │  - Registers 'copilotcli' session type             │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Session Providers                                  │     │
│  │  - CopilotCLIChatSessionItemProvider               │     │
│  │    * provideChatSessionItems()                     │     │
│  │    * Converts CLI sessions → ChatSessionItem       │     │
│  │  - CopilotCLIChatSessionContentProvider            │     │
│  │    * provideChatSessionContent()                   │     │
│  │    * Returns history + options                     │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  CopilotCLIChatSessionParticipant                  │     │
│  │  - handleRequest() routes user input               │     │
│  │  - Manages session lifecycle                       │     │
│  │  - Handles delegation confirmations                │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Services                                           │     │
│  │  - ICopilotCLISessionService (session wrapper)     │     │
│  │  - ICopilotCLIModels (model selection)             │     │
│  │  - ICopilotCLIAgents (custom agents)               │     │
│  │  - IChatSessionWorktreeService (isolation)         │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  CopilotCLISession (Wrapper)                       │     │
│  │  - Wraps SDK Session                               │     │
│  │  - Streams responses to VS Code                    │     │
│  │  - Handles permission requests                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Copilot CLI SDK (@github/copilot)               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  LocalSessionManager                                │     │
│  │  - createSession(options)                          │     │
│  │  - getSession(sessionId, options)                  │     │
│  │  - listSessions()                                  │     │
│  │  - deleteSession(sessionId)                        │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Session                                            │     │
│  │  - send(prompt, attachments)                       │     │
│  │  - getEvents() → SessionEvent[]                    │     │
│  │  - emit(event) to add messages                     │     │
│  │  - on('*', handler) for event streaming            │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Persistence Layer                                  │     │
│  │  - ~/.copilot/session-state/*.jsonl                │     │
│  │  - Session metadata (startTime, summary, model)    │     │
│  │  - Full event stream (user/assistant messages)     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Session Provider Types

The system supports three types of session providers, defined in [AgentSessionProviders enum](../../vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentSessions.ts):

| Provider | Value | Icon | Use Case |
|----------|-------|------|----------|
| **Local** | `'local'` | vm (Codicon.vm) | Standard chat in VS Code editor context |
| **Background (CLI)** | `'copilotcli'` | worktree (Codicon.worktree) | Autonomous CLI agent with optional isolation |
| **Cloud** | `'copilot-cloud-agent'` | cloud (Codicon.cloud) | GitHub-integrated cloud agents |

This document focuses on the **Background (CLI)** provider.

## Registration Flow

### 1. Extension Activation

When the Copilot Chat extension activates ([chatSessions.ts](../../feima-code/src/extension/chatSessions/vscode-node/chatSessions.ts)):

```typescript
export class ChatSessionsContrib extends Disposable implements IExtensionContribution {
    static readonly ID = 'github.copilot.chat.chatSessions';
    
    constructor(@IInstantiationService instantiationService: IInstantiationService) {
        // Register 'copilotcli' session providers
        const copilotcliSessionType = 'copilotcli';
        
        // 1. Create Item Provider
        const itemProvider = instantiationService.createInstance(
            CopilotCLIChatSessionItemProvider
        );
        
        // 2. Create Content Provider
        const contentProvider = instantiationService.createInstance(
            CopilotCLIChatSessionContentProvider
        );
        
        // 3. Create Participant
        const participant = instantiationService.createInstance(
            CopilotCLIChatSessionParticipant
        );
        
        // Register with VS Code
        this._register(vscode.chat.registerChatSessionItemProvider(
            copilotcliSessionType, 
            itemProvider
        ));
        
        this._register(vscode.chat.registerChatSessionContentProvider(
            copilotcliSessionType, 
            contentProvider
        ));
    }
}
```

### 2. VS Code Core Handling

VS Code's `ChatSessionsService` registers these providers and makes them available through:

- **Chat View UI**: Session list with filter for "Background Agents"
- **Session Creation**: "New Background Agent" button
- **Delegation**: "Continue In → Background Agent" from local chat

### 3. Dependency Injection

The extension uses these core services:

- **ICopilotCLISessionService**: Session wrapper management
- **ICopilotCLISDK**: CLI SDK package access
- **ICopilotCLIModels**: Model selection and default model
- **ICopilotCLIAgents**: Custom agent management
- **IChatSessionWorktreeService**: Git worktree isolation

## Session Lifecycle

### Untitled Session Creation

When user creates a new background agent session:

```
┌────────────────────────────────────────────────────────┐
│ 1. User Action: "New Background Agent" in Chat View   │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 2. VS Code creates untitled session                   │
│    - Resource: untitled:Untitled-<N>.copilotcli       │
│    - Status: Not started                               │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 3. ContentProvider.provideChatSessionContent()        │
│    - Returns empty history                             │
│    - Returns option groups: model, agent, isolation    │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 4. User enters first prompt                            │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 5. Participant.handleRequest() invoked                │
│    - chatSessionContext.isUntitled = true              │
│    - Creates CLI SDK session                           │
│    - Generates real session ID: "cli-<uuid>"          │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 6. ItemProvider.swap() updates UI                     │
│    - Old: untitled:Untitled-N.copilotcli              │
│    - New: copilotcli-session:cli-<uuid>               │
│    - Label: First 50 chars of user prompt             │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│ 7. SDK persists session to disk                       │
│    - File: ~/.copilot/session-state/cli-<uuid>.jsonl │
│    - Metadata: startTime, summary, model               │
│    - Events: user.message, assistant.message, etc.    │
└────────────────────────────────────────────────────────┘
```

### Session ID Mapping

The extension maintains two ID mappings:

1. **Untitled → Real ID** (`_untitledSessionIdMap`):
   - Temporary mapping during session creation
   - Maps `untitled:xyz` → `cli-<uuid>`
   - Cleaned up after swap completes

2. **Session Model** (`_sessionModel`):
   - Tracks model selection per session
   - Key: Real session ID
   - Value: Model ID (e.g., "gpt-4", "claude-sonnet-4")

## Request Flow: Delegation from VS Code Chat

### Sequence Diagram

```
User                VS Code Chat        Participant           SessionService       CLI SDK
 │                       │                   │                      │                 │
 │ 1. Type "@cli task"  │                   │                      │                 │
 │──────────────────────>│                   │                      │                 │
 │                       │                   │                      │                 │
 │                       │ 2. handleRequest()│                      │                 │
 │                       │──────────────────>│                      │                 │
 │                       │  (chatSessionContext)                    │                 │
 │                       │   = undefined     │                      │                 │
 │                       │                   │                      │                 │
 │                       │                   │ 3. Check uncommitted │                 │
 │                       │                   │    changes          │                 │
 │                       │                   │──────┐               │                 │
 │                       │                   │      │               │                 │
 │                       │                   │<─────┘               │                 │
 │                       │                   │                      │                 │
 │                       │ 4. Show confirmation:                    │                 │
 │                       │    "Include changes?"                    │                 │
 │<──────────────────────│──────────────────│                      │                 │
 │  [Copy/Move/Skip]     │                   │                      │                 │
 │                       │                   │                      │                 │
 │ 5. User selects "Copy"│                   │                      │                 │
 │──────────────────────>│                   │                      │                 │
 │                       │                   │                      │                 │
 │                       │ 6. handleRequest()│                      │                 │
 │                       │   (confirmation)  │                      │                 │
 │                       │──────────────────>│                      │                 │
 │                       │                   │                      │                 │
 │                       │                   │ 7. createWorktree()  │                 │
 │                       │                   │──────────────────────>│                 │
 │                       │                   │                      │                 │
 │                       │                   │ 8. copyChanges()     │                 │
 │                       │                   │──────────────────────>│                 │
 │                       │                   │                      │                 │
 │                       │                   │ 9. createSession()   │                 │
 │                       │                   │──────────────────────>│                 │
 │                       │                   │                      │                 │
 │                       │                   │                      │ 10. createSession│
 │                       │                   │                      │────────────────>│
 │                       │                   │                      │                 │
 │                       │                   │                      │ 11. Session ID  │
 │                       │                   │                      │<────────────────│
 │                       │                   │   (CopilotCLISession)│                 │
 │                       │                   │<─────────────────────│                 │
 │                       │                   │                      │                 │
 │                       │ 12. openSessionWithPrompt              │                 │
 │                       │    command (new chat editor)           │                 │
 │                       │<──────────────────│                      │                 │
 │                       │                   │                      │                 │
 │                       │ 13. New chat editor│                      │                 │
 │                       │    with session    │                      │                 │
 │<──────────────────────│                   │                      │                 │
 │  Background Agent     │                   │                      │                 │
 │  working...           │                   │                      │                 │
 │                       │                   │                      │                 │
 │                       │                   │ 14. session.handleRequest()            │
 │                       │                   │──────────────────────────────────────>│
 │                       │                   │    (prompt, attachments)               │
 │                       │                   │                      │                 │
 │                       │                   │                      │ 15. Stream events│
 │                       │                   │<────────────────────────────────────────│
 │                       │                   │   (assistant.message, tool.execution_*)│
 │                       │ 16. Stream to UI  │                      │                 │
 │<──────────────────────│<──────────────────│                      │                 │
 │  Markdown, thinking,  │                   │                      │                 │
 │  tool invocations     │                   │                      │                 │
```

### Key Steps Explained

#### Step 1-2: Delegation Detection

When user types `@cli <task>` or clicks "Continue In → Background Agent", the request comes to `CopilotCLIChatSessionParticipant.handleRequest()` with:
- `chatSessionContext = undefined` (no existing session)
- `request.prompt` contains the task description

#### Step 3-5: Uncommitted Changes Confirmation

If workspace has uncommitted changes AND worktree isolation is supported:

```typescript
const confirmationResult = await showConfirmation({
    title: 'Delegate to Background Agent',
    message: 'This workspace has uncommitted changes. Should these changes be included in the new worktree?',
    buttons: ['Copy Changes', 'Move Changes', 'Skip Changes', 'Cancel']
});
```

Options:
- **Copy**: Git stash + apply to worktree (preserves workspace changes)
- **Move**: Migrate changes to worktree (clears workspace)
- **Skip**: Start clean worktree from HEAD
- **Cancel**: Abort delegation

#### Step 7-8: Worktree Creation

If isolation enabled:

```typescript
const worktreeProperties = await worktreeService.createWorktree(stream);
// Creates: <repo>/.git/worktrees/copilot-cli-<uuid>
// Working dir: <repo>/../copilot-cli-<uuid>

if (uncommittedChangesAction === 'copy' || 'move') {
    await gitService.migrateChanges(
        worktreeUri, 
        activeRepositoryUri, 
        { deleteFromSource: uncommittedChangesAction === 'move' }
    );
}
```

#### Step 9-11: CLI Session Creation

```typescript
const session = await sessionService.createSession({
    model: 'claude-sonnet-4',
    workingDirectory: worktreeUri,
    isolationEnabled: true,
    agent: customAgent // optional
}, token);

// SDK creates session file:
// ~/.copilot/session-state/cli-<uuid>.jsonl
```

#### Step 12-13: Open New Chat Editor

Instead of blocking the original chat, delegate to a new chat editor:

```typescript
await vscode.commands.executeCommand(
    'workbench.action.chat.openSessionWithPrompt.copilotcli', 
    {
        resource: SessionIdForCLI.getResource(sessionId),
        prompt: userPrompt,
        attachedContext: references
    }
);

// Returns to original chat with message:
stream.markdown('A background agent has begun working on your request...');
```

#### Step 14-16: Async Request Execution

Session executes in background without blocking:

```typescript
session.handleRequest(requestId, prompt, attachments, modelId, token)
    .then(() => commitWorktreeChangesIfNeeded(session, token))
    .catch(error => logService.error(error))
    .finally(() => session.dispose());
```

## Request Flow: Existing Session

When user sends a message in an existing background session:

```
User                ChatEditor          Participant           Session             CLI SDK
 │                       │                   │                      │                 │
 │ 1. Type message       │                   │                      │                 │
 │──────────────────────>│                   │                      │                 │
 │                       │                   │                      │                 │
 │                       │ 2. handleRequest()│                      │                 │
 │                       │──────────────────>│                      │                 │
 │                       │  (chatSessionContext.chatSessionItem)    │                 │
 │                       │   .resource = "copilotcli-session:cli-xyz"                │
 │                       │   .isUntitled = false                    │                 │
 │                       │                   │                      │                 │
 │                       │                   │ 3. getOrCreateSession()                │
 │                       │                   │──────────────────────>│                 │
 │                       │                   │   (existing ID)      │                 │
 │                       │                   │                      │                 │
 │                       │                   │                      │ 4. getSession() │
 │                       │                   │                      │────────────────>│
 │                       │                   │                      │                 │
 │                       │                   │                      │ 5. Load from disk│
 │                       │                   │                      │  ~/.copilot/    │
 │                       │                   │                      │  session-state/ │
 │                       │                   │                      │                 │
 │                       │                   │                      │ 6. Session      │
 │                       │                   │                      │<────────────────│
 │                       │                   │   (CopilotCLISession)│                 │
 │                       │                   │<─────────────────────│                 │
 │                       │                   │                      │                 │
 │                       │                   │ 7. resolvePrompt()   │                 │
 │                       │                   │   (with references)  │                 │
 │                       │                   │──────┐               │                 │
 │                       │                   │      │               │                 │
 │                       │                   │<─────┘               │                 │
 │                       │                   │                      │                 │
 │                       │                   │ 8. handleRequest()   │                 │
 │                       │                   │──────────────────────>│                 │
 │                       │                   │                      │                 │
 │                       │                   │                      │ 9. send()       │
 │                       │                   │                      │────────────────>│
 │                       │                   │                      │                 │
 │                       │                   │                      │ 10. Stream      │
 │                       │                   │<────────────────────────────────────────│
 │                       │ 11. Render response                      │                 │
 │<──────────────────────│<──────────────────│                      │                 │
```

**Key difference from delegation**: Session already exists, so SDK loads history from disk and continues conversation.

## Request Flow: Standalone CLI

When user runs `gh copilot` directly in terminal:

```
Terminal            Shell              Copilot CLI          LocalSessionManager
 │                       │                   │                      │
 │ 1. gh copilot         │                   │                      │
 │──────────────────────>│                   │                      │
 │                       │                   │                      │
 │                       │ 2. Execute CLI    │                      │
 │                       │──────────────────>│                      │
 │                       │                   │                      │
 │                       │                   │ 3. Initialize        │
 │                       │                   │──────────────────────>│
 │                       │                   │                      │
 │                       │                   │ 4. createSession()   │
 │                       │                   │──────────────────────>│
 │                       │                   │                      │
 │                       │ 5. Prompt: "What can I help with?"       │
 │<──────────────────────│<──────────────────│                      │
 │                       │                   │                      │
 │ 6. User types task    │                   │                      │
 │──────────────────────>│                   │                      │
 │                       │                   │                      │
 │                       │ 7. Send prompt    │                      │
 │                       │──────────────────>│                      │
 │                       │                   │                      │
 │                       │                   │ 8. session.send()    │
 │                       │                   │──────────────────────>│
 │                       │                   │                      │
 │                       │                   │ 9. Stream to stdout  │
 │<──────────────────────│<──────────────────│<─────────────────────│
 │  Assistant response   │                   │                      │
 │  Tool executions      │                   │                      │
 │                       │                   │                      │
 │                       │                   │ 10. Persist          │
 │                       │                   │    ~/.copilot/       │
 │                       │                   │    session-state/    │
 │                       │                   │──────────────────────>│
```

**VS Code Detection**: If VS Code is running with Copilot Chat extension, the Chat View automatically detects the new session via:

```typescript
// CopilotCLISessionService monitors session files
const watcher = fileSystem.createFileSystemWatcher(
    new RelativePattern('~/.copilot/session-state', '*.jsonl')
);
watcher.onDidCreate(() => this._onDidChangeSessions.fire());
```

User can then:
1. **View in Chat View**: Session appears in "Background Agents" filter
2. **Open in Editor**: Right-click → "Open as Editor" to view as chat
3. **Resume in Terminal**: Right-click → "Resume Agent Session in Terminal"

## Session History Storage

### Storage Responsibility Matrix

| Scenario | History Storage | Metadata Storage | Session State |
|----------|----------------|------------------|---------------|
| **Delegated (from VS Code)** | CLI SDK (disk: ~/.copilot/session-state/*.jsonl) | Extension (in-memory _sessionWrappers) | Synced |
| **Standalone (terminal)** | CLI SDK (disk: ~/.copilot/session-state/*.jsonl) | CLI SDK (disk) | Independent |
| **Reopened in VS Code** | CLI SDK (loaded from disk) | Extension (reconstructed) | Synced |

### Session History Format

CLI SDK persists sessions as [JSONL](https://jsonlines.org/) (JSON Lines) files:

**File: `~/.copilot/session-state/cli-abc123.jsonl`**

```jsonl
{"type":"session.start","timestamp":"2025-01-08T10:00:00Z","sessionId":"cli-abc123","model":"claude-sonnet-4"}
{"type":"user.message","timestamp":"2025-01-08T10:00:01Z","id":"msg_1","data":{"content":"Create a new React component for user profile"}}
{"type":"assistant.message","timestamp":"2025-01-08T10:00:02Z","id":"msg_2","data":{"messageId":"msg_2","content":"I'll create a React component for you."}}
{"type":"tool.execution_start","timestamp":"2025-01-08T10:00:03Z","data":{"toolCallId":"tool_1","toolName":"write","parameters":{"path":"UserProfile.tsx","content":"..."}}}
{"type":"tool.execution_complete","timestamp":"2025-01-08T10:00:04Z","data":{"toolCallId":"tool_1","success":true}}
{"type":"assistant.message","timestamp":"2025-01-08T10:00:05Z","id":"msg_3","data":{"messageId":"msg_3","content":"Created UserProfile.tsx"}}
```

### Accessing History

**From Extension**:

```typescript
const session = await sessionService.getSession(sessionId, options, token);
const history = session.object.getChatHistory();
// Returns: (ChatRequestTurn2 | ChatResponseTurn2)[]
```

**From CLI SDK directly**:

```typescript
const events = session.getEvents();
// Returns: SessionEvent[]
// Event types: user.message, assistant.message, tool.execution_start, 
//              tool.execution_complete, session.error
```

### History Synchronization

When VS Code opens an existing CLI session:

1. **ItemProvider lists sessions** → SDK returns metadata (ID, startTime, summary)
2. **ContentProvider loads history** → SDK returns full event stream
3. **Extension converts events** → `buildChatHistoryFromEvents()` converts to VS Code format
4. **Chat View renders** → Standard chat UI with full conversation

**No double storage**: Extension doesn't duplicate history. It always reads from SDK on demand.

## Option Management

### Option Groups

Background agent sessions support three option groups ([copilotCLIChatSessionsContribution.ts](../../feima-code/src/extension/chatSessions/vscode-node/copilotCLIChatSessionsContribution.ts)):

#### 1. Model Selection (MODELS_OPTION_ID)

```typescript
const modelOptions = await copilotCLIModels.getModels();
// Returns: ChatSessionProviderOptionItem[]
// Example: [
//   { id: 'gpt-4', label: 'GPT-4' },
//   { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
//   { id: 'o1-preview', label: 'O1 Preview' }
// ]

const selectedModel = await copilotCLIModels.getDefaultModel();
```

**Model Resolution Priority**:
1. Prompt file header: `model: gpt-4`
2. Session model (existing session only): `_sessionModel.get(sessionId)`
3. Request model (delegation): `request.model?.id`
4. Default model: User setting or system default

#### 2. Agent Selection (AGENTS_OPTION_ID)

```typescript
const agentOptions = await copilotCLIAgents.getAgents();
// Returns: SweCustomAgent[]
// Example: [
//   { name: 'default', instructions: '...', tools: [...] },
//   { name: 'code-review', instructions: '...', tools: [...] },
//   { name: 'test-writer', instructions: '...', tools: [...] }
// ]

const selectedAgent = await copilotCLIAgents.getDefaultAgent();
```

**Agent Resolution Priority**:
1. Prompt file header: `agent: code-review`
2. Session agent (existing session): `getSessionAgent(sessionId)`
3. Default agent: User setting or `___vscode_default___`

#### 3. Isolation Mode (ISOLATION_OPTION_ID)

```typescript
const isolationOptions = [
    { id: 'workspace', label: 'Workspace', description: 'Work directly in workspace' },
    { id: 'worktree', label: 'Worktree', description: 'Isolated Git worktree' }
];

const isolationPreference = isolationManager.getIsolationPreference(sessionId);
```

**Isolation States**:
- **Workspace**: Changes applied directly to active workspace
- **Worktree**: Changes in `<repo>/../copilot-cli-<uuid>/`
- **Locked (after worktree created)**: Cannot change, shows branch name

### Option Change Handling

When user changes an option mid-session:

```typescript
async provideHandleOptionsChange(
    resource: Uri, 
    optionId: string, 
    value: string, 
    token: CancellationToken
): Promise<void> {
    const sessionId = SessionIdForCLI.parse(resource);
    
    switch (optionId) {
        case MODELS_OPTION_ID:
            _sessionModel.set(sessionId, value);
            // Next request uses new model
            break;
            
        case AGENTS_OPTION_ID:
            await copilotCLIAgents.trackSessionAgent(sessionId, value);
            // Next request uses new agent
            break;
            
        case ISOLATION_OPTION_ID:
            isolationManager.setIsolationPreference(sessionId, value === 'worktree');
            // Applied on next session creation only
            break;
    }
}
```

**Note**: Isolation can only be set before first request. After worktree is created, option is locked.

## Worktree Isolation

### Architecture

```
Main Workspace                          Worktree
/home/user/project/                     /home/user/copilot-cli-abc123/
├── .git/                               ├── .git → ../project/.git/worktrees/copilot-cli-abc123
│   └── worktrees/                      ├── src/
│       └── copilot-cli-abc123/         │   ├── index.ts (modified by agent)
│           ├── HEAD                    │   └── utils.ts (created by agent)
│           └── ...                     └── package.json
├── src/
│   ├── index.ts (unchanged)
│   └── main.ts (user editing)
└── package.json
```

### Worktree Lifecycle

#### Creation

```typescript
async createWorktree(stream: ChatResponseStream): Promise<ChatSessionWorktreeProperties> {
    const repo = gitService.activeRepository.get();
    const baseBranch = repo.state.HEAD.name; // e.g., "main"
    const uuid = generateUuid();
    const branchName = `copilot-cli-${uuid.substring(0, 8)}`;
    const worktreePath = path.join(repo.rootUri.fsPath, '..', branchName);
    
    // Create Git worktree
    await gitService.createWorktree(
        repo.rootUri, 
        worktreePath, 
        baseBranch, 
        branchName
    );
    
    stream.markdown(`✓ Created worktree: ${branchName}`);
    
    return {
        worktreePath,
        branchName,
        baseBranch,
        repositoryUri: repo.rootUri
    };
}
```

#### Change Migration

When user selects "Copy Changes" or "Move Changes":

```typescript
await gitService.migrateChanges(
    worktreeUri,           // destination
    activeRepositoryUri,   // source
    {
        confirmation: false,
        deleteFromSource: moveOrCopyChanges === 'move', // true for move
        untracked: true    // include untracked files
    }
);

// Internally uses git stash/apply
// 1. git stash save --include-untracked (in workspace)
// 2. git stash apply (in worktree)
// 3. git stash drop (if move)
```

#### Auto-Commit on Completion

When session completes successfully:

```typescript
async commitWorktreeChangesIfNeeded(session: ICopilotCLISession, token: CancellationToken) {
    if (session.status === ChatSessionStatus.Completed && 
        session.options.isolationEnabled &&
        !token.isCancellationRequested) {
        
        await worktreeService.handleRequestCompleted(session.sessionId);
        // Stages all changes: git add -A
        // Commits: git commit -m "Background agent changes: <session-id>"
    }
}
```

#### Applying Changes to Workspace

User reviews changes and applies:

```typescript
// Command: github.copilot.chat.applyCopilotCLIAgentSessionChanges
async applyWorktreeChanges(sessionId: string) {
    const worktreePath = this.getWorktreePath(sessionId);
    const mainRepo = gitService.activeRepository.get();
    
    // Create patch from worktree commits
    const patch = await gitService.createPatch(
        worktreePath,
        'HEAD~1..HEAD' // all commits since branch creation
    );
    
    // Apply to main workspace
    await gitService.applyPatch(mainRepo.rootUri, patch);
    
    // Optionally merge branch or create PR
}
```

#### Cleanup

```typescript
// Command: github.copilot.cli.sessions.delete
async deleteSession(sessionId: string) {
    // 1. Delete SDK session
    await sessionService.deleteSession(sessionId);
    
    // 2. Delete worktree
    const worktreePath = worktreeService.getWorktreePath(sessionId);
    if (worktreePath) {
        const repo = gitService.activeRepository.get();
        await gitService.deleteWorktree(repo.rootUri, worktreePath.fsPath);
        // Removes: worktree directory + .git/worktrees/copilot-cli-*
    }
}
```

### Worktree Best Practices

**When to use Workspace mode**:
- Simple refactoring tasks
- Documentation updates
- Quick bug fixes
- No risk of conflicts

**When to use Worktree mode**:
- Large feature implementations
- Experimental changes
- Multiple parallel tasks
- User actively editing same files

## Terminal Integration

### Opening Terminal

```typescript
// Command: github.copilot.cli.sessions.resumeInTerminal
async resumeCopilotCLISessionInTerminal(sessionItem: ChatSessionItem) {
    const sessionId = SessionIdForCLI.parse(sessionItem.resource);
    
    // Open terminal with CLI pre-loaded
    await copilotCLITerminalIntegration.openTerminal(
        `Copilot CLI (${sessionItem.label})`,
        ['--session-id', sessionId]
    );
}
```

### Terminal Initialization

The extension creates shell shims in `~/.vscode-insiders/globalStorage/github.copilot/copilotCli/`:

**For Bash/Zsh** (copilotCLIShim.sh):
```bash
#!/bin/sh
unset NODE_OPTIONS
ELECTRON_RUN_AS_NODE=1 "/path/to/vscode" "/path/to/copilotCLIShim.js" "$@"
```

**For PowerShell** (copilotCLIShim.ps1):
```powershell
$env:NODE_OPTIONS = $null
& "/path/to/vscode" "/path/to/copilotCLIShim.js" $args
```

These shims invoke VS Code's Node runtime to execute the CLI SDK, ensuring consistency with extension environment.

### Shell Integration

If terminal has shell integration:

```typescript
if (terminal.shellIntegration) {
    // Use shell integration for better UX
    terminal.shellIntegration.executeCommand(command);
} else {
    // Fallback to sendText
    terminal.sendText(command);
}
```

Shell integration provides:
- Command tracking in terminal history
- Proper exit code handling
- Command decoration (success/failure icons)

## Permission Management

### Permission Request Flow

When CLI SDK needs to perform sensitive operations:

```
SDK Session            CopilotCLISession      Permission Handler    User
 │                          │                        │                │
 │ 1. requestPermission()   │                        │                │
 │─────────────────────────>│                        │                │
 │   (path, operation)      │                        │                │
 │                          │                        │                │
 │                          │ 2. Check auto-approve  │                │
 │                          │────────┐               │                │
 │                          │        │ Workspace?    │                │
 │                          │<───────┘ Read-only?    │                │
 │                          │                        │                │
 │                          │ 3. requestPermission() │                │
 │                          │───────────────────────>│                │
 │                          │                        │                │
 │                          │                        │ 4. Show UI     │
 │                          │                        │───────────────>│
 │                          │                        │ "Allow CLI to  │
 │                          │                        │  write to X?"  │
 │                          │                        │                │
 │                          │                        │ 5. User choice │
 │                          │                        │<───────────────│
 │                          │  6. Result             │  [Yes/No]      │
 │                          │<───────────────────────│                │
 │  7. approved/denied      │                        │                │
 │<─────────────────────────│                        │                │
```

### Permission Types

#### 1. File Read (`kind: 'read'`)

```typescript
if (permissionRequest.kind === 'read') {
    const filePath = Uri.file(permissionRequest.path);
    
    // Auto-approve reads within workspace/worktree
    if (workingDirectory && isEqualOrParent(filePath, workingDirectory)) {
        return { kind: 'approved' };
    }
    
    // Require approval for external files
    return await showPermissionRequest(
        `Allow reading ${permissionRequest.path}?`
    );
}
```

#### 2. File Write (`kind: 'write'`)

```typescript
if (permissionRequest.kind === 'write') {
    const filePath = Uri.file(permissionRequest.path);
    
    // Check if this is tracked edit tool invocation
    if (editTracker.hasTrackedEdit(filePath)) {
        // Already approved via tool confirmation
        return { kind: 'approved' };
    }
    
    // Require explicit approval
    return await showPermissionRequest(
        `Allow writing to ${permissionRequest.path}?`
    );
}
```

#### 3. Shell Command (`kind: 'shell'`)

```typescript
if (permissionRequest.kind === 'shell') {
    // Show command to user
    return await showPermissionRequest(
        `Allow executing: ${permissionRequest.command}?`,
        { command: permissionRequest.command }
    );
}
```

### Tool Call Confirmation

For edit tools (e.g., `write_file`, `edit_file`), permission is requested at tool invocation time:

```typescript
// When tool.execution_start event fires
session.on('tool.execution_start', async (event) => {
    if (isCopilotCliEditToolCall(event.data)) {
        // Extract affected files
        const files = getAffectedUrisForEditTool(event.data);
        
        // Request permission for all files
        const approved = await requiresFileEditconfirmation(
            event.data.toolName,
            files,
            permissionHandler,
            toolInvocationToken
        );
        
        if (!approved) {
            // User denied, SDK will skip tool execution
            return { kind: 'denied-interactively-by-user' };
        }
        
        // Track approval for write permission requests
        editTracker.startEdit(event.data.toolCallId, files);
    }
});
```

## End-to-End Call Chain: Delegation Example

Complete trace of delegating "Add unit tests for UserService" from VS Code Chat to background agent:

```
1. User types "@cli Add unit tests for UserService" in VS Code Chat
   ↓
2. vscode.chat API → ExtHostChat (Extension Host)
   - Type: ChatRequest
   - Participant: (none, delegation detected)
   - Command: undefined
   
3. ExtHostChat → MainThreadChat (VS Code Core, via RPC)
   - Serialized request
   
4. MainThreadChat → ChatModel → ChatService
   - Determines this is delegation (no participant specified, @cli prefix)
   
5. ChatService → chatSessionsProvider → CopilotCLIChatSessionParticipant
   - handleRequest(request, context, stream, token)
   - chatSessionContext = undefined (delegation)
   
6. Participant detects delegation → handleDelegationFromAnotherChat()
   - Checks uncommitted changes: hasUncommittedChanges = true
   
7. Participant → stream.confirmation()
   - Sends to VS Code UI: "Include uncommitted changes?"
   - Buttons: [Copy, Move, Skip, Cancel]
   - Returns ChatResult {} to unblock original chat
   
8. User clicks "Copy Changes"
   ↓
9. VS Code Chat → Participant.handleRequest() (second call)
   - confirmationResults = [{ step: 'uncommitted-changes', accepted: true, metadata: { action: 'copy' }}]
   
10. Participant → getOrInitializeWorkingDirectory()
    - isolationEnabled = true
    - uncommittedChangesAction = 'copy'
    
11. Participant → IChatSessionWorktreeService.createWorktree()
    - Creates: /home/user/project/../copilot-cli-a1b2c3d4/
    - Branch: copilot-cli-a1b2c3d4
    - Returns: { worktreePath, branchName, repositoryUri }
    
12. Participant → IGitService.migrateChanges()
    - git stash save --include-untracked (in workspace)
    - git stash apply (in worktree)
    - stream.markdown("✓ Changes migrated to worktree")
    
13. Participant → ICopilotCLIModels.getDefaultModel()
    - Returns: "claude-sonnet-4"
    
14. Participant → ICopilotCLIAgents.getDefaultAgent()
    - Returns: undefined (use default)
    
15. Participant → ChatVariablesCollection(request.references)
    - Resolves #file:UserService.ts
    - Creates Attachment[] for SDK
    
16. Participant → ICopilotCLISessionService.createSession()
    ↓
17. SessionService → ICopilotCLIMCPHandler.loadMcpConfig()
    - Loads MCP servers from worktree (if configured)
    - Returns: SessionOptions['mcpServers']
    
18. SessionService → CopilotCLISessionOptions constructor
    - model: "claude-sonnet-4"
    - workingDirectory: Uri.file("/home/user/copilot-cli-a1b2c3d4")
    - isolationEnabled: true
    - agent: undefined
    - mcpServers: [...]
    
19. SessionService → ICopilotCLISDK.getPackage()
    - Returns: @github/copilot/sdk package
    
20. SessionService → LocalSessionManager.createSession(options)
    ↓
21. LocalSessionManager (SDK) → Creates Session object
    - sessionId: "cli-f9e8d7c6-b5a4-3210-9876-543210abcdef"
    - Persists to: ~/.copilot/session-state/cli-f9e8d7c6....jsonl
    - Writes: {"type":"session.start","sessionId":"cli-f9e8d7c6...","model":"claude-sonnet-4"}
    
22. SessionService → CopilotCLISession constructor
    - Wraps SDK Session
    - Sets up event handlers
    
23. SessionService → RefCountedSession wrapper
    - Tracks reference count for disposal
    
24. SessionService ← returns session to Participant
    
25. Participant → vscode.commands.executeCommand()
    - Command: 'workbench.action.chat.openSessionWithPrompt.copilotcli'
    - Args: {
        resource: Uri.parse('copilotcli-session:cli-f9e8d7c6...'),
        prompt: "Add unit tests for UserService",
        attachedContext: [{ uri: UserService.ts, ... }]
      }
    
26. VS Code Core → Opens new Chat Editor
    - Editor shows: "Background Agent (Add unit tests for UserService)"
    - Status: In Progress
    - Options: Model: claude-sonnet-4, Agent: Default, Isolation: Worktree (locked)
    
27. Participant (async, no await) → session.handleRequest()
    ↓
28. CopilotCLISession.handleRequest()
    - _pendingPrompt = "Add unit tests for UserService"
    - _status = ChatSessionStatus.InProgress
    - _statusChange.fire(InProgress)
    
29. Session → SDK session.send()
    - prompt: "Add unit tests for UserService\n\nAttachments:\n- UserService.ts"
    - attachments: [{ type: 'file', uri: 'file:///home/user/.../UserService.ts', content: '...' }]
    - abortController: connected to CancellationToken
    
30. SDK Session → Copilot LLM API (claude-sonnet-4)
    - System prompt includes: custom instructions, MCP servers
    - User message: "Add unit tests for UserService..."
    - Attachments sent as context
    
31. SDK Session → event: 'user.message'
    - data: { content: "Add unit tests for UserService..." }
    - Persisted to session-state file
    
32. LLM → Streams response chunks
    ↓
33. SDK Session → event: 'assistant.message' (multiple times)
    - data: { chunkContent: "I'll create unit tests..." }
    - CopilotCLISession handler → stream.markdown()
    - VS Code Chat Editor updates UI in real-time
    
34. LLM decides to use tool: write_file
    ↓
35. SDK Session → event: 'tool.execution_start'
    - data: {
        toolCallId: "tool_001",
        toolName: "write_file",
        parameters: {
          path: "tests/UserService.test.ts",
          content: "import { UserService } from '../UserService';\n\ndescribe('UserService', () => { ... });"
        }
      }
    
36. CopilotCLISession → Permission handler
    - Detects edit tool
    - Extracts URI: file:///home/user/copilot-cli-a1b2c3d4/tests/UserService.test.ts
    
37. Permission handler → requiresFileEditconfirmation()
    - Shows VS Code confirmation dialog
    - "Allow writing to tests/UserService.test.ts?"
    - Buttons: [Allow, Deny]
    
38. User clicks "Allow"
    ↓
39. Permission handler ← returns { kind: 'approved' }
    
40. CopilotCLISession → EditTracker.startEdit()
    - Tracks tool_001 → UserService.test.ts
    
41. SDK Session → CopilotCLISessionOptions.permissionHandler()
    - Returns: approved
    
42. SDK executes tool: write_file
    - Writes file to: /home/user/copilot-cli-a1b2c3d4/tests/UserService.test.ts
    
43. SDK Session → event: 'tool.execution_complete'
    - data: { toolCallId: "tool_001", success: true }
    - CopilotCLISession handler → EditTracker.completeEdit()
    - stream.push(ChatToolInvocationPart) → UI shows "✓ Created UserService.test.ts"
    
44. LLM continues with more tools or final message
    - Example: run_command("npm test")
    - Repeat steps 35-43 for each tool
    
45. LLM finishes response
    ↓
46. SDK Session → persist all events
    - Appends to ~/.copilot/session-state/cli-f9e8d7c6....jsonl
    - {"type":"assistant.message",...}
    - {"type":"tool.execution_complete",...}
    
47. CopilotCLISession.handleRequest() completes
    - _status = ChatSessionStatus.Completed
    - _statusChange.fire(Completed)
    
48. Participant → commitWorktreeChangesIfNeeded()
    ↓
49. IChatSessionWorktreeService.handleRequestCompleted()
    - cd /home/user/copilot-cli-a1b2c3d4
    - git add -A
    - git commit -m "Background agent changes: cli-f9e8d7c6"
    
50. VS Code Chat Editor updates:
    - Status: ✓ Completed
    - Shows button: "Apply Changes"
    - Shows file summary: "1 file created: tests/UserService.test.ts"
    
51. User clicks "Apply Changes"
    ↓
52. VS Code → Command: github.copilot.chat.applyCopilotCLIAgentSessionChanges
    ↓
53. Worktree Service → applyWorktreeChanges()
    - Creates patch from worktree commits
    - Applies to main workspace
    - Shows diff view: "Background Agent (copilot-cli-a1b2c3d4)"
    
54. User reviews diff → Accepts changes
    
55. Main workspace now has:
    - tests/UserService.test.ts (new file)
    - All uncommitted changes still present (copied, not moved)
    
56. User can now delete session or keep for history:
    - Right-click → "Delete Session and Worktree"
    - Or keep for reference
```

**Total time**: ~30-60 seconds for this example (varies by task complexity)

**Key observations**:
- **Two ChatRequest calls**: Initial delegation + confirmation response
- **Async execution**: `openSessionWithPrompt` command returns immediately
- **Event streaming**: Real-time UI updates via SDK event handlers
- **Permission points**: Worktree creation (implicit), file writes (explicit)
- **History stored once**: All events persisted by SDK to single JSONL file

## Comparison: Delegation vs Standalone

| Aspect | Delegation (from VS Code) | Standalone (Terminal) |
|--------|---------------------------|----------------------|
| **Invocation** | `@cli` in chat or "Continue In → Background" | `gh copilot` command |
| **Session Creation** | Via SessionService wrapper | Direct SDK LocalSessionManager |
| **History Visibility** | VS Code Chat View + Terminal | Terminal only (unless VS Code running) |
| **Worktree Isolation** | Configurable with confirmation | Configurable via CLI flags |
| **Permission Handling** | VS Code UI confirmations | Terminal prompts |
| **Model Selection** | VS Code settings + per-session UI | CLI flags or interactive menu |
| **Custom Agents** | VS Code agent picker | CLI `--agent` flag |
| **MCP Servers** | Loaded from workspace config | Loaded from ~/.copilot/config.json |
| **Context Attachments** | Resolved from #file, #symbol, etc. | Manual file paths or @workspace |
| **Session Resumption** | Open in Chat Editor or Terminal | Continue in terminal session |
| **Change Application** | "Apply Changes" button → diff view | Manual `git cherry-pick` or merge |

## Architecture Decisions

### Why Wrap SDK Sessions?

**CopilotCLISession wraps SDK Session** instead of using it directly:

1. **Stream Integration**: Bridge SDK events → VS Code ChatResponseStream
2. **Permission Handling**: Intercept SDK permission requests → VS Code UI
3. **Lifecycle Management**: RefCounted disposal with timeout after completion
4. **Status Tracking**: Map SDK states → VS Code ChatSessionStatus enum
5. **Edit Tracking**: Correlate tool executions with file permissions

### Why Two ID Mappings?

**_untitledSessionIdMap and _sessionModel** serve different purposes:

1. **_untitledSessionIdMap** (`Map<string, string>`):
   - Maps: Untitled URI ID → Real SDK session ID
   - Lifetime: Created on first request, deleted after swap
   - Purpose: Enable UI swap from untitled to real session

2. **_sessionModel** (`Map<string, string>`):
   - Maps: Real SDK session ID → Model ID
   - Lifetime: Persists for extension lifetime
   - Purpose: Remember model selection per session (SDK doesn't expose this)

### Why LocalSessionManager in Extension?

Extension creates LocalSessionManager instead of spawning CLI process:

**Advantages**:
- Reuse VS Code's Node.js runtime (no extra process)
- Direct access to SDK API (no IPC needed)
- Faster session creation (no CLI startup time)
- Shared authentication state

**Trade-off**: Couples extension to CLI SDK version

### Session Persistence Strategy

**SDK owns persistence**, extension only caches:

**Rationale**:
- SDK session files are source of truth
- Extension can be reloaded without losing history
- Standalone CLI and VS Code see same sessions
- No synchronization conflicts

**Extension caching**:
- In-memory `_sessionWrappers` for active sessions
- Workspace state for session-to-workspace association
- No duplication of event history

## Testing Strategies

### Unit Tests

Key test files:
- `copilotcliSession.spec.ts`: Session wrapper behavior
- `copilotCLIChatSessionsContribution.spec.ts`: Provider implementations

**Mock Strategy**:
```typescript
const mockSDKSession: Session = {
    sessionId: 'test-session',
    send: vi.fn(),
    getEvents: vi.fn(() => []),
    on: vi.fn(),
    emit: vi.fn(),
    // ...
};
```

### Integration Tests

Test delegation flow end-to-end:

```typescript
suite('CLI Delegation Integration', () => {
    test('delegate from local chat to background agent', async () => {
        // 1. Create local chat session
        const localChat = await createLocalChatSession();
        
        // 2. Send delegation request
        await localChat.sendRequest({ prompt: '@cli task' });
        
        // 3. Verify confirmation shown
        assert.ok(confirmationShown);
        
        // 4. Accept confirmation
        await respondToConfirmation('copy');
        
        // 5. Verify worktree created
        const worktree = await getWorktreeForSession(sessionId);
        assert.ok(worktree);
        
        // 6. Verify session started
        const session = await getSession(sessionId);
        assert.equal(session.status, ChatSessionStatus.InProgress);
    });
});
```

### Manual Testing Checklist

- [ ] Create background agent from Chat View
- [ ] Delegate from local chat with `@cli`
- [ ] Delegate from local chat with "Continue In → Background"
- [ ] Handle uncommitted changes: Copy, Move, Skip
- [ ] Resume session in terminal
- [ ] Change model mid-session
- [ ] Change agent mid-session
- [ ] Apply worktree changes to workspace
- [ ] Delete session with worktree cleanup
- [ ] Verify standalone CLI session appears in Chat View
- [ ] Verify session persists after VS Code reload

## Related Documentation

- **[Chat Sessions API](./08-chat-sessions.md)**: Foundation API for session providers
- **[Language Model Provider](./01-language-model-provider.md)**: Model selection and routing
- **[VS Code API: Chat Sessions](https://code.visualstudio.com/docs/copilot/agents/background-agents)**: User-facing documentation
- **[GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)**: CLI usage and features

## References

- **VS Code Core**: `src/vs/workbench/contrib/chat/`
  - `browser/agentSessions/agentSessions.ts`: Session provider types
  - `common/chatSessionsService.ts`: Service interfaces
  - `browser/chatEditor.ts`: Chat editor implementation
  
- **Copilot Chat Extension**: `src/extension/`
  - `chatSessions/vscode-node/chatSessions.ts`: Registration
  - `chatSessions/vscode-node/copilotCLIChatSessionsContribution.ts`: Providers & participant
  - `agents/copilotcli/node/copilotcliSessionService.ts`: Session service
  - `agents/copilotcli/node/copilotcliSession.ts`: Session wrapper
  - `chatSessions/vscode-node/copilotCLITerminalIntegration.ts`: Terminal support

- **CLI SDK**: `@github/copilot/sdk`
  - `internal.LocalSessionManager`: Session lifecycle
  - `Session`: Request/response handling
  - `SessionEvent`: Event streaming
  - `SweCustomAgent`: Agent configuration

---

**Last Updated**: January 8, 2025  
**Document Version**: 1.0  
**Authors**: VS Code + Copilot Chat Architecture Team
