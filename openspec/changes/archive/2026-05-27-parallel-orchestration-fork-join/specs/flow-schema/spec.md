## ADDED Requirements

### Requirement: `orchestration` enum includes `parallel`, not `cli`
The flow schema SHALL accept `parallel` as a valid value for the `orchestration` field. The value `cli` SHALL be rejected with a validation error directing users to use `parallel`.

#### Scenario: Schema accepts `orchestration: parallel`
- **WHEN** a `.flow.yaml` document sets `orchestration: parallel`
- **THEN** schema validation SHALL pass for that field value

#### Scenario: Schema rejects `orchestration: cli`
- **WHEN** a `.flow.yaml` document sets `orchestration: cli`
- **THEN** schema validation SHALL fail with an error that includes the text "use 'parallel' instead"

---

### Requirement: `groups` field on parallel flows
The flow schema SHALL define a `groups` property (array of group objects) available only when `orchestration: parallel`. Each group object SHALL have:
- `name` (string, required)
- `roles` (array of role objects, required, min 1)
- `isolation` (enum: `workspace` | `worktree`, optional)
- `model` (string, optional)
- `skills` (array of skill refs, optional)
- `contexts` (array of context refs, optional)

#### Scenario: Valid group object passes schema validation
- **WHEN** a group object contains `name` and a non-empty `roles` array
- **THEN** schema validation SHALL pass

#### Scenario: Group object missing `name` fails schema validation
- **WHEN** a group object omits the `name` field
- **THEN** schema validation SHALL fail with a required-field error

---

### Requirement: `join` field on parallel flows
The flow schema SHALL define a `join` property (a single role object) available when `orchestration: parallel`. The `join` role object SHALL follow the same shape as `IFlowRole` (name, prompt, agent, model, skills, contexts, args).

#### Scenario: Valid `join` role passes schema validation
- **WHEN** the `join` field contains a role object with at least a `name`
- **THEN** schema validation SHALL pass

---

## REMOVED Requirements

### Requirement: `cliMode` field
**Reason**: The `supervised` / `autonomous` execution mode distinction is removed. Execution behavior is now determined by the group's prompt, tools, and agent configuration.
**Migration**: Remove `cliMode` from any `.flow.yaml` files. Configure execution behavior through the join role's tools and prompt instead.

### Requirement: Flow-level `isolation` field
**Reason**: `isolation` moves to the group level. A flow-level isolation setting is meaningless when different groups may require different isolation strategies.
**Migration**: Move `isolation` from the flow root into each `groups[*]` entry that requires it.
