## ADDED Requirements

### Requirement: Tool names auto-complete in tools array
The system SHALL provide auto-completion for tool names when editing the `tools` array in a flow file. Completion SHALL be available after the `-` character in a YAML list.

#### Scenario: Tool completion shows available tools
- **WHEN** user types `- ` in the `tools` array of a flow file
- **THEN** completion SHALL show all available tools from `vscode.lm.tools`
- **AND** each completion item SHALL include the tool name as label
- **AND** each completion item SHALL include tool description as documentation

#### Scenario: Tool completion filters by prefix
- **WHEN** user types `- read` in the `tools` array
- **THEN** completion SHALL show only tools starting with "read"
- **AND** completion SHALL be case-insensitive

#### Scenario: Tool completion inserts tool name
- **WHEN** user selects a tool from completion list
- **THEN** system SHALL insert the tool name into the document
- **AND** inserted text SHALL be properly formatted as YAML string

---

### Requirement: Agent files auto-complete in agent field
The system SHALL provide auto-completion for agent file paths when editing the `agent` field in a flow role. Completion SHALL scan `.github/agents/` and `.agents/` directories for `.agent.md` files.

#### Scenario: Agent completion shows available agents
- **WHEN** user types `agent:` in a role definition
- **THEN** completion SHALL show all available agent files
- **AND** each completion item SHALL use the agent name (filename without `.agent.md`) as label
- **AND** each completion item SHALL insert the agent name (not full path)

#### Scenario: Agent completion filters by prefix
- **WHEN** user types `agent: code` in a role definition
- **THEN** completion SHALL show only agents starting with "code"
- **AND** completion SHALL be case-insensitive

#### Scenario: Agent completion scans both directories
- **WHEN** user requests agent completion
- **THEN** system SHALL scan both `.github/agents/` and `.agents/` directories
- **AND** completion SHALL include agents from both directories
- **AND** duplicate names SHALL be de-duplicated

#### Scenario: Agent completion handles missing directories
- **WHEN** `.github/agents/` or `.agents/` directories do not exist
- **THEN** completion SHALL still work (scan other directory or return empty list)
- **AND** no error SHALL be shown to user

---

### Requirement: Prompt files auto-complete in skills array
The system SHALL provide auto-completion for prompt file paths when editing the `skills` array in a flow role. Completion SHALL scan `.github/prompts/` and `.vscode/prompts/` directories for `.prompt.md` files.

#### Scenario: Prompt completion shows available prompts
- **WHEN** user types `- ` in the `skills` array of a role
- **THEN** completion SHALL show all available prompt files
- **AND** each completion item SHALL use the prompt name (filename without `.prompt.md`) as label
- **AND** each completion item SHALL insert the prompt name (not full path)

#### Scenario: Prompt completion filters by prefix
- **WHEN** user types `- yaml` in the `skills` array
- **THEN** completion SHALL show only prompts starting with "yaml"
- **AND** completion SHALL be case-insensitive

#### Scenario: Prompt completion scans both directories
- **WHEN** user requests prompt completion
- **THEN** system SHALL scan both `.github/prompts/` and `.vscode/prompts/` directories
- **AND** completion SHALL include prompts from both directories
- **AND** duplicate names SHALL be de-duplicated

#### Scenario: Prompt completion handles missing directories
- **WHEN** `.github/prompts/` or `.vscode/prompts/` directories do not exist
- **THEN** completion SHALL still work (scan other directory or return empty list)
- **AND** no error SHALL be shown to user

---

### Requirement: Completion providers update on file changes
The system SHALL refresh completion suggestions when agent or prompt files are added, removed, or modified.

#### Scenario: Agent completion updates after file addition
- **WHEN** user adds a new `.agent.md` file to `.github/agents/` or `.agents/`
- **THEN** agent completion SHALL include the new agent in subsequent completion requests

#### Scenario: Prompt completion updates after file deletion
- **WHEN** user deletes a `.prompt.md` file from `.github/prompts/` or `.vscode/prompts/`
- **THEN** prompt completion SHALL exclude the deleted prompt in subsequent completion requests

#### Scenario: Tool completion updates when tools change
- **WHEN** a tool is registered or unregistered via `vscode.lm.registerTool`
- **THEN** tool completion SHALL reflect the updated tool list in subsequent completion requests

---

### Requirement: Completion only activates in flow files
The system SHALL only provide flow-specific completion (tools, agents, prompts) when editing `*.flow.yaml` or `*.flow.yml` files.

#### Scenario: Completion not available in non-flow files
- **WHEN** user edits a non-flow YAML file
- **THEN** flow-specific completion SHALL NOT be triggered
- **AND** standard YAML completion SHALL still work

#### Scenario: Completion available in flow files
- **WHEN** user edits a `*.flow.yaml` or `*.flow.yml` file
- **THEN** flow-specific completion SHALL be available in appropriate contexts