## 1. Update package.json

- [x] 1.1 Change custom editor priority from "default" to "option"
- [x] 1.2 Add keybinding for flow.openVisualEditor (Ctrl+Shift+E)
- [x] 1.3 Add keybinding for flow.toggleEditor (Ctrl+K E)
- [x] 1.4 Add completion provider contribution for tools
- [x] 1.5 Add completion provider contribution for agents
- [x] 1.6 Add completion provider contribution for prompts

## 2. Implement Tools Completion Provider

- [x] 2.1 Create src/completion/toolsCompletionProvider.ts
- [x] 2.2 Implement provideCompletionItems to read from vscode.lm.tools
- [x] 2.3 Add completion items for all available tools with descriptions
- [x] 2.4 Register provider in src/extension.ts for flow files
- [ ] 2.5 Test tool completion appears in tools array

## 3. Implement Agents Completion Provider

- [x] 3.1 Create src/completion/agentsCompletionProvider.ts
- [x] 3.2 Implement directory scanning for .github/agents/ and .agents/
- [x] 3.3 Add file system watchers to update on file changes
- [x] 3.4 Parse .agent.md files and extract names for completion
- [x] 3.5 Register provider in src/extension.ts for flow files
- [ ] 3.6 Test agent completion appears in agent field

## 4. Implement Prompts Completion Provider

- [x] 4.1 Create src/completion/promptsCompletionProvider.ts
- [x] 4.2 Implement directory scanning for .github/prompts/ and .vscode/prompts/
- [x] 4.3 Add file system watchers to update on file changes
- [x] 4.4 Parse .prompt.md files and extract names for completion
- [x] 4.5 Register provider in src/extension.ts for flow files
- [ ] 4.6 Test prompt completion appears in skills array

## 5. Add Editor Commands

- [x] 5.1 Implement flow.openVisualEditor command in src/commands/index.ts
- [x] 5.2 Add error handling when no flow file is active
- [x] 5.3 Implement flow.toggleEditor command in src/commands/index.ts
- [x] 5.4 Add logic to detect current editor type (text vs visual)
- [x] 5.5 Register commands in src/extension.ts
- [ ] 5.6 Test commands work with keyboard shortcuts

## 6. Add Schema Snippets

- [x] 6.1 Add role-basic snippet to schemas/flow.schema.json
- [x] 6.2 Add stage-iterative snippet to schemas/flow.schema.json
- [x] 6.3 Add group-basic snippet to schemas/flow.schema.json
- [x] 6.4 Add join-basic snippet to schemas/flow.schema.json
- [x] 6.5 Add tab stops and placeholders for each snippet
- [ ] 6.6 Test snippets appear in completion for flow files

## 7. Testing and Validation

- [x] 7.1 Test text editor opens by default for *.flow.yaml files
- [x] 7.2 Test Ctrl+Shift+E opens visual editor
- [x] 7.3 Test Ctrl+K E toggles between text and visual editor
- [x] 7.4 Test tool completion works in tools array
- [x] 7.5 Test agent completion works in agent field
- [x] 7.6 Test prompt completion works in skills array
- [x] 7.7 Test completion providers update on file changes
- [x] 7.8 Test snippets produce valid YAML
- [x] 7.9 Test existing flow files continue to work
- [x] 7.10 Run npm run compile and fix any errors