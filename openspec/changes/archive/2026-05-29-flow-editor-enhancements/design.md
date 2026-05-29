## Context

The current flow editor implementation uses a custom webview-based visual editor as the default editor for `*.flow.yaml` files. This provides a graphical representation of flows but has several limitations:

1. **Performance**: The webview takes time to load, especially for large files
2. **Editing workflow**: Many users prefer text-based YAML editing with syntax highlighting and validation
3. **Discovery**: Users lack intelligent auto-completion for tools, agents, and prompts when editing flow files
4. **Accessibility**: Text editor is more accessible and works better with screen readers

The extension already has a skill completion provider that uses `vscode.chat.getSkills()`, providing a proven pattern for similar completion features.

## Goals / Non-Goals

**Goals:**
- Enable text-first editing experience for flow files (matching markdown preview pattern)
- Provide intelligent auto-completion for tools, agents, and prompts in flow YAML
- Add quick keyboard shortcuts to access visual editor when needed
- Accelerate flow creation with common pattern snippets
- Maintain backward compatibility with existing flow files

**Non-Goals:**
- Modifying flow execution logic or semantics
- Changing the flow schema structure
- Implementing inline completion (ghost text) - using standard completion instead
- Replacing the visual editor - it remains accessible via commands

## Decisions

### 1. Custom Editor Priority: "option" instead of "default"

**Decision:** Change `customEditors[0].priority` from `"default"` to `"option"` in `package.json`.

**Rationale:**
- Matches VS Code's markdown preview pattern (text editor first, preview available via command)
- Users can still open visual editor via command palette or keyboard shortcut
- Faster initial file opening - text editor loads immediately
- Better for users who prefer text-based editing workflow

**Alternatives considered:**
- Keep `"default"` but add user setting to toggle: Too complex, adds configuration surface
- Remove custom editor entirely: Breaks visual editor for users who need it
- Add both `"default"` and `"option"` entries: VS Code doesn't support this

### 2. Completion Provider Architecture: Three Separate Providers

**Decision:** Implement three separate `CompletionItemProvider` instances:
- `toolsCompletionProvider.ts`: Completes tool names from `vscode.lm.tools`
- `agentsCompletionProvider.ts`: Completes agent files from directory scans
- `promptsCompletionProvider.ts`: Completes prompt files from directory scans

**Rationale:**
- Follows VS Code's multi-provider architecture (providers don't conflict, VS Code merges results)
- Separation of concerns - each provider handles one resource type
- Easier to test and maintain independently
- Matches existing `skillCompletionProvider.ts` pattern

**Alternatives considered:**
- Single provider for all three: Harder to maintain, less clear separation
- Use `InlineCompletionItemProvider`: Designed for predictive text, not discovery of enumerated lists

### 3. Tool Completion: Use `vscode.lm.tools` Observable Array

**Decision:** Read from `vscode.lm.tools` array (always available, not chat-session dependent).

**Rationale:**
- `vscode.lm.tools` is a readonly array that's always populated with registered tools
- No need to handle chat session lifecycle or availability checks
- Simpler implementation - just read the array and map to completion items

**Alternatives considered:**
- Listen to `onDidChangeChatModels` event: Tools don't change with models, unnecessary complexity
- Cache tools in extension context: `vscode.lm.tools` is already efficient, caching adds complexity

### 4. Agent/Prompt Discovery: Directory Scanning

**Decision:** Scan directories for agent and prompt files:
- Agents: `.github/agents/` and `.agents/`
- Prompts: `.github/prompts/` and `.vscode/prompts/`

**Rationale:**
- No VS Code API exists to enumerate agents/prompts (unlike skills via `vscode.chat.getSkills()`)
- Directory scanning is reliable and follows VS Code conventions
- Workspace-relative paths work correctly with multi-root workspaces

**Alternatives considered:**
- Use `vscode.workspace.findFiles()`: Good for initial scan, but need file system watchers for updates
- Cache results in extension context: Adds complexity, file system watcher is simpler
- Only scan on extension activation: Stale results if files change

### 5. Keyboard Shortcuts: Ctrl+Shift+E and Ctrl+K E

**Decision:**
- `flow.openVisualEditor`: Ctrl+Shift+E (open visual editor for current file)
- `flow.toggleEditor`: Ctrl+K E (toggle between text and visual editor)

**Rationale:**
- Ctrl+Shift+E is mnemonic and unused by default
- Ctrl+K E follows VS Code's chord pattern (Ctrl+K is a prefix key)
- "Edit" vs "View" distinction - since we're editing flows, Ctrl+Shift+E is appropriate
- Quick access without going through command palette

**Alternatives considered:**
- Ctrl+Shift+V (view): Conflicts with markdown preview toggle
- F4 (next problem): Already used for diagnostics navigation
- No shortcuts (command palette only): Slower, less discoverable

### 6. Schema Snippets: JSON Schema-based

**Decision:** Add `snippets` section to `schemas/flow.schema.json` with common patterns.

**Rationale:**
- VS Code's YAML extension supports JSON Schema snippets
- Snippets are context-aware based on cursor position in YAML
- Single source of truth for both validation and snippets
- Works across all YAML editors, not just our extension

**Alternatives considered:**
- VS Code snippets (`.code-snippets` files): Not context-aware for YAML structure
- Template files: Users have to copy-paste, less convenient
- No snippets: Users must type everything manually

## Risks / Trade-offs

### Risk: Users may not discover the visual editor

**Mitigation:**
- Add command to Command Palette with clear description: "Open Flow Visual Editor"
- Add keyboard shortcut (Ctrl+Shift+E) for quick access
- Add status bar indicator when visual editor is available (optional future enhancement)
- Document in README and getting started guide

### Risk: Completion providers may conflict with YAML Language Server

**Mitigation:**
- VS Code automatically merges results from multiple completion providers
- Our providers use specific trigger characters (e.g., `-` for lists, `:` for values)
- YAML Language Server provides general YAML completions, we provide flow-specific ones
- Tested with existing skill completion provider - no conflicts observed

### Risk: Directory scanning performance on large workspaces

**Mitigation:**
- Use file system watchers to only rescan when directories change
- Limit scan depth (don't recurse deeply)
- Cache results and invalidate on change events
- Async scanning doesn't block editor startup

### Risk: Tool completion may show stale results

**Mitigation:**
- `vscode.lm.tools` is updated by VS Code when tools are registered/unregistered
- No additional caching needed - read fresh on each completion request
- Completion is fast enough to not require caching

### Trade-off: Text-first vs Visual-first

**Trade-off:** Text editor opens first, but visual editor requires explicit action.

**Rationale:** Most users prefer text editing for YAML, and visual editor is still accessible. This matches VS Code's markdown pattern (text editor first, preview available).

## Migration Plan

### Deployment Steps

1. **Update `package.json`**:
   - Change `customEditors[0].priority` to `"option"`
   - Add keybindings for `flow.openVisualEditor` and `flow.toggleEditor`
   - Add completion provider contributions

2. **Implement completion providers**:
   - Create `src/completion/toolsCompletionProvider.ts`
   - Create `src/completion/agentsCompletionProvider.ts`
   - Create `src/completion/promptsCompletionProvider.ts`
   - Register providers in `src/extension.ts`

3. **Add commands**:
   - Implement `flow.openVisualEditor` command
   - Implement `flow.toggleEditor` command
   - Register in `src/commands/index.ts`

4. **Add schema snippets**:
   - Update `schemas/flow.schema.json` with `snippets` section
   - Test snippets appear in completion

5. **Testing**:
   - Test text editor opens by default for `*.flow.yaml`
   - Test keyboard shortcuts open visual editor
   - Test completion providers work for tools, agents, prompts
   - Test snippets appear in completion
   - Test existing flow files continue to work

### Rollback Strategy

If issues arise:
1. Revert `package.json` priority change to restore visual editor as default
2. Disable completion providers by commenting out registration code
3. Remove keybindings to prevent command conflicts
4. Extension remains functional, just without new features

### Open Questions

None - all technical decisions are clear.