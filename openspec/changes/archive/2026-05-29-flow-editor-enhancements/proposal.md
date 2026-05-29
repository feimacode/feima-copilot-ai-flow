## Why

The current flow editor experience opens the custom visual editor by default, which can be slow and doesn't support the full YAML editing workflow that many users prefer. Additionally, users lack intelligent auto-completion for tools, agents, and prompts when editing flow files, making it harder to discover available resources.

## What Changes

- **Text Editor First**: Change custom editor priority from `"default"` to `"option"` so text editor opens first for `*.flow.yaml` files (matching markdown preview pattern)
- **Tools Completion**: Add `CompletionItemProvider` that offers auto-completion for tool names from `vscode.lm.tools` array
- **Agents Completion**: Add `CompletionItemProvider` that scans `.github/agents/` and `.agents/` directories for agent files and offers completion
- **Prompts Completion**: Add `CompletionItemProvider` that scans `.github/prompts/` and `.vscode/prompts/` directories for prompt files and offers completion
- **Keyboard Shortcuts**: Add commands `flow.openVisualEditor` (Ctrl+Shift+E) and `flow.toggleEditor` (Ctrl+K E) for quick editor switching
- **Schema Snippets**: Add common flow snippets to JSON schema for role-basic, stage-iterative, group-basic, join-basic patterns

## Capabilities

### New Capabilities

- `flow-completion`: Intelligent auto-completion for tools, agents, and prompts in flow YAML files
- `editor-shortcuts`: Keyboard shortcuts for opening visual editor and toggling between text/visual editors
- `flow-snippets`: Schema-based code snippets for common flow patterns

### Modified Capabilities

None - no spec-level requirement changes to existing capabilities

## Impact

- **Code Changes**:
  - `package.json`: Change `customEditors[0].priority` from `"default"` to `"option"`, add keybindings, add completion contributions
  - `src/completion/`: New completion providers for tools, agents, and prompts
  - `src/commands/`: Add `flow.openVisualEditor` and `flow.toggleEditor` commands
  - `schemas/flow.schema.json`: Add `snippets` section with common patterns

- **User Experience**:
  - Faster file opening (text editor loads immediately)
  - Better discoverability of available tools, agents, and prompts
  - Quick keyboard access to visual editor when needed
  - Faster flow creation with snippets

- **Dependencies**:
  - Uses existing `vscode.lm.tools` API (no new dependencies)
  - Uses existing `vscode.chat.getSkills()` API pattern for agents/prompts
  - No new external dependencies

- **Compatibility**:
  - Visual editor still accessible via command palette or keyboard shortcut
  - Existing flow files continue to work unchanged
  - No breaking changes to flow schema or execution