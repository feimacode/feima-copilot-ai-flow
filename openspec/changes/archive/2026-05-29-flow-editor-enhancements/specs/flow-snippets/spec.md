## ADDED Requirements

### Requirement: Role-basic snippet exists
The system SHALL provide a code snippet for creating a basic flow with a single role.

#### Scenario: Role-basic snippet appears in completion
- **WHEN** user types "role" at the root level of a flow file
- **THEN** "role-basic" snippet SHALL appear in completion list
- **AND** snippet SHALL have description "Basic flow with single role"

#### Scenario: Role-basic snippet inserts template
- **WHEN** user selects "role-basic" snippet
- **THEN** system SHALL insert a complete flow template with:
  - `name` field with placeholder
  - `roles` array with one role
  - Role with `name`, `prompt`, and optional `model` fields
  - Proper YAML indentation

#### Scenario: Role-basic snippet has placeholders
- **WHEN** user selects "role-basic" snippet
- **THEN** inserted template SHALL have tab stops for:
  - Flow name
  - Role name
  - Role prompt
  - Optional model name

---

### Requirement: Stage-iterative snippet exists
The system SHALL provide a code snippet for creating a flow with iterative stages.

#### Scenario: Stage-iterative snippet appears in completion
- **WHEN** user types "stage" at the root level of a flow file
- **THEN** "stage-iterative" snippet SHALL appear in completion list
- **AND** snippet SHALL have description "Flow with iterative stages"

#### Scenario: Stage-iterative snippet inserts template
- **WHEN** user selects "stage-iterative" snippet
- **THEN** system SHALL insert a complete flow template with:
  - `name` field with placeholder
  - `stages` array with one stage
  - Stage with `name`, `iterations` (default: 3), and `roles` array
  - At least one role in the stage
  - Proper YAML indentation

#### Scenario: Stage-iterative snippet has placeholders
- **WHEN** user selects "stage-iterative" snippet
- **THEN** inserted template SHALL have tab stops for:
  - Flow name
  - Stage name
  - Iterations count
  - Role names
  - Role prompts

---

### Requirement: Group-basic snippet exists
The system SHALL provide a code snippet for creating a flow with parallel groups.

#### Scenario: Group-basic snippet appears in completion
- **WHEN** user types "group" at the root level of a flow file
- **THEN** "group-basic" snippet SHALL appear in completion list
- **AND** snippet SHALL have description "Flow with parallel groups"

#### Scenario: Group-basic snippet inserts template
- **WHEN** user selects "group-basic" snippet
- **THEN** system SHALL insert a complete flow template with:
  - `name` field with placeholder
  - `groups` array with one group
  - Group with `name` and `roles` array
  - At least one role in the group
  - `join` role at root level
  - Proper YAML indentation

#### Scenario: Group-basic snippet has placeholders
- **WHEN** user selects "group-basic" snippet
- **THEN** inserted template SHALL have tab stops for:
  - Flow name
  - Group name
  - Role names in group
  - Role prompts
  - Join role name
  - Join role prompt

---

### Requirement: Join-basic snippet exists
The system SHALL provide a code snippet for creating a join role for parallel flows.

#### Scenario: Join-basic snippet appears in completion
- **WHEN** user types "join" at the root level of a flow file
- **THEN** "join-basic" snippet SHALL appear in completion list
- **AND** snippet SHALL have description "Join role for parallel flows"

#### Scenario: Join-basic snippet inserts template
- **WHEN** user selects "join-basic" snippet
- **THEN** system SHALL insert a join role template with:
  - `name` field with placeholder
  - `prompt` field with placeholder
  - Optional `model` field
  - Proper YAML indentation

#### Scenario: Join-basic snippet has placeholders
- **WHEN** user selects "join-basic" snippet
- **THEN** inserted template SHALL have tab stops for:
  - Join role name
  - Join role prompt
  - Optional model name

---

### Requirement: Snippets only appear in flow files
The system SHALL only show flow snippets when editing `*.flow.yaml` or `*.flow.yml` files.

#### Scenario: Snippets not available in non-flow files
- **WHEN** user edits a non-flow YAML file
- **THEN** flow snippets SHALL NOT appear in completion list
- **AND** standard YAML snippets SHALL still work

#### Scenario: Snippets available in flow files
- **WHEN** user edits a `*.flow.yaml` or `*.flow.yml` file
- **THEN** flow snippets SHALL appear in appropriate contexts
- **AND** snippets SHALL be context-aware (role-basic at root, etc.)

---

### Requirement: Snippets follow flow schema
The system SHALL ensure all snippets produce valid YAML that conforms to the flow schema.

#### Scenario: Role-basic snippet is valid
- **WHEN** user inserts "role-basic" snippet
- **THEN** resulting YAML SHALL pass flow schema validation
- **AND** no validation errors SHALL appear

#### Scenario: Stage-iterative snippet is valid
- **WHEN** user inserts "stage-iterative" snippet
- **THEN** resulting YAML SHALL pass flow schema validation
- **AND** no validation errors SHALL appear

#### Scenario: Group-basic snippet is valid
- **WHEN** user inserts "group-basic" snippet
- **THEN** resulting YAML SHALL pass flow schema validation
- **AND** no validation errors SHALL appear