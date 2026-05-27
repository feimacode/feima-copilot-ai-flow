# parallel-orchestration Specification

## Purpose
TBD - created by archiving change parallel-orchestration-fork-join. Update Purpose after archive.
## Requirements
### Requirement: Parallel orchestration mode
The system SHALL support `orchestration: parallel` as a valid orchestration strategy in `.flow.yaml` files. A parallel flow SHALL define a `groups` array and a `join` role. The `groups` array SHALL contain at least 2 group entries. The `join` role SHALL be executed after all groups have completed (or failed).

#### Scenario: Parallel flow with groups executes all groups then join
- **WHEN** a flow with `orchestration: parallel` is executed
- **THEN** the engine SHALL execute each group's roles sequentially within that group, execute all groups before running the join role, and stream group progress to the chat response

#### Scenario: Parallel flow without groups is rejected
- **WHEN** a flow with `orchestration: parallel` has no `groups` field
- **THEN** validation SHALL fail with the message "parallel orchestration requires a 'groups' array with at least 2 entries"

#### Scenario: Parallel flow without join role is rejected
- **WHEN** a flow with `orchestration: parallel` has no `join` field
- **THEN** validation SHALL fail with the message "parallel orchestration requires a 'join' role"

---

### Requirement: Group definition
Each entry in the `groups` array SHALL have a `name` (string, required) and a `roles` array (required, minimum 1 role). Groups SHALL optionally have `isolation` (`workspace` | `worktree`), `model` (string), `skills`, and `contexts`. Groups SHALL NOT contain nested `stages`.

#### Scenario: Group with valid roles executes its role sequence
- **WHEN** a group contains roles R1, R2, R3
- **THEN** the engine SHALL execute R1, then R2, then R3 in order, accumulating output as each role's context

#### Scenario: Group with no roles is rejected
- **WHEN** a group entry has an empty or missing `roles` array
- **THEN** validation SHALL fail with "group '<name>' must have at least 1 role"

---

### Requirement: Per-group isolation
Each group SHALL optionally declare `isolation: workspace | worktree`. When `isolation: worktree` is set, the group's background agent SHALL operate in a dedicated Git worktree. When omitted, no isolation is applied.

#### Scenario: Groups with different isolation strategies coexist
- **WHEN** Group A has `isolation: worktree` and Group B has `isolation: workspace`
- **THEN** each group's isolation mode SHALL be applied independently

---

### Requirement: Group failure tolerance
When a group's execution fails (any role throws or the agent errors), the system SHALL log the failure, mark the group as failed, and continue executing the remaining groups. The join role SHALL still execute.

#### Scenario: Failed group does not abort remaining groups
- **WHEN** Group A fails during execution
- **THEN** Group B and Group C SHALL still execute, and the join role SHALL still run

#### Scenario: Failed group error is surfaced to join role
- **WHEN** a group fails with error message E
- **THEN** the join role's context for that group SHALL contain: "⚠ Group failed: E"

---

### Requirement: Join role with structured group context
The join role SHALL receive each group's output as a separately labeled context file. Each context file SHALL be labeled `[Group: <name>]` and contain the group's full accumulated role output (or failure notice). The join role's prompt SHALL have access to all group context files in its rendering pipeline.

#### Scenario: Join role receives labeled outputs for all groups
- **WHEN** 3 groups complete (2 succeed, 1 fails)
- **THEN** the join role's context SHALL contain 3 labeled sections, 2 with full output and 1 with a failure notice

#### Scenario: Join role can act as human gate
- **WHEN** the join role's `prompt` and `tools` are configured for human approval workflows
- **THEN** the join role SHALL behave as a human gate, awaiting user confirmation before producing output

