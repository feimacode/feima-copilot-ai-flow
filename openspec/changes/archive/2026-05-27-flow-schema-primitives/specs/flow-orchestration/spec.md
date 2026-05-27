## REMOVED Requirements

### Requirement: orchestration field
**Reason**: The `orchestration:` top-level field couples structural pattern with execution path and prevents hybrid flows. Structural pattern is now determined by which root key is present (`roles:`, `stages:`, or `groups:`+`join:`).
**Migration**: Remove `orchestration:` from all `.flow.yaml` files. For `orchestration: sequence` + `roles:` → keep only `roles:`. For `orchestration: sequence` + `stages:` → keep only `stages:`. For `orchestration: parallel` → keep `groups:` and `join:`. For `orchestration: cli` → use a pipeline or iterative flow where every role has `delegate: true`.

## ADDED Requirements

### Requirement: Implicit structural pattern from root key
The flow parser and validator SHALL determine the structural execution pattern from exactly one of the following mutually exclusive root-level keys: `roles:` (pipeline), `stages:` (iterative), `groups:` + `join:` (fork-join). A flow file SHALL NOT have more than one of these root-level structures present simultaneously.

#### Scenario: roles-only flow dispatches to executePipeline
- **WHEN** a flow file has a `roles:` array at root and no `stages:` or `groups:`
- **THEN** the engine SHALL call `executePipeline()`

#### Scenario: stages-only flow dispatches to executeIterative
- **WHEN** a flow file has a `stages:` array at root and no `roles:` or `groups:`
- **THEN** the engine SHALL call `executeIterative()`

#### Scenario: groups + join flow dispatches to executeForkJoin
- **WHEN** a flow file has a `groups:` array and a `join:` object at root and no `roles:` or `stages:`
- **THEN** the engine SHALL call `executeForkJoin()`

#### Scenario: ambiguous root structure is rejected at validation
- **WHEN** a flow file has more than one of `roles:`, `stages:`, `groups:` at root
- **THEN** the validator SHALL return a validation error naming the conflicting keys

#### Scenario: no root structure key is rejected at validation
- **WHEN** a flow file has none of `roles:`, `stages:`, `groups:` at root
- **THEN** the validator SHALL return a validation error indicating a root structure key is required

### Requirement: Engine method names match structural primitives
The engine implementation SHALL use method names that reflect the structural pattern: `executePipeline` (was `executeSequential`), `executeIterative` (was `executeStages`), `executeForkJoin` (was `executeParallel`). The SDK execution method SHALL be named `callRoleAgent` (was `callRoleSdk`).

#### Scenario: Method names are consistent with AGENTS.md mapping table
- **WHEN** an AI agent reads `AGENTS.md` and then reads `flowEngine.ts`
- **THEN** every method name in the mapping table SHALL exist in the engine with the exact name listed
