## ADDED Requirements

### Requirement: Role delegate annotation
An `IFlowRole` SHALL support an optional `delegate` boolean field. When `delegate: true`, the engine SHALL route that role's execution through `callRoleAgent()` (Copilot SDK runtime) instead of `callRole()` (VS Code LM API).

#### Scenario: Role with delegate true uses agent runtime
- **WHEN** a role in a pipeline, iterative stage, or fork-join group has `delegate: true`
- **THEN** the engine calls `callRoleAgent()` for that role instead of `callRole()`

#### Scenario: Role without delegate annotation uses LM API runtime
- **WHEN** a role has no `delegate` field (or `delegate: false`)
- **THEN** the engine calls `callRole()` for that role (VS Code LM API path)

#### Scenario: delegate and agent are independent
- **WHEN** a role has both `agent: "my-agent"` and `delegate: true`
- **THEN** `agent:` resolves the prompt content source (loads `.agent.md` body as system prompt) AND `delegate: true` routes execution through the SDK runtime — both take effect independently

#### Scenario: delegate true without agent field
- **WHEN** a role has `delegate: true` and an inline `prompt:` but no `agent:` field
- **THEN** the SDK executor SHALL use the inline prompt string as the system prompt, with no content-source resolution error

### Requirement: callRoleAgent accepts contextFiles
`callRoleAgent()` SHALL accept a `contextFiles: ContextFile[]` parameter. The implementation SHALL serialize these files into `sharedContext` before invoking the SDK executor, so delegated roles with `contexts:` receive those files.

#### Scenario: Context files reach delegated role
- **WHEN** a role has `delegate: true` and the flow defines `contexts:` entries
- **THEN** the resolved context file contents SHALL be serialized and passed to the SDK executor via `sharedContext`

#### Scenario: Empty context files are a no-op
- **WHEN** a role has `delegate: true` and no `contexts:` entries
- **THEN** `callRoleAgent()` SHALL invoke the SDK executor without error and without injecting empty context
