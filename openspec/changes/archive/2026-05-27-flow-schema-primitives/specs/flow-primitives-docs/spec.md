## ADDED Requirements

### Requirement: FLOW_PRIMITIVES.md human reference
A `docs/FLOW_PRIMITIVES.md` file SHALL exist in the repository. It SHALL cover: (1) the three structural patterns (pipeline, iterative, fork-join) with ASCII diagrams and minimal YAML examples; (2) the two role-level axes (prompt source and execution path) with an orthogonality explanation; (3) the inheritance chain for `skills:`, `contexts:`, and `tools:`; (4) a migration guide from the old `orchestration:` field.

#### Scenario: All three structural patterns are documented with diagrams
- **WHEN** a developer opens `docs/FLOW_PRIMITIVES.md`
- **THEN** they SHALL find an ASCII diagram and a minimal YAML example for each of `roles:` (pipeline), `stages:` (iterative), and `groups:`+`join:` (fork-join)

#### Scenario: Two-axis orthogonality is explained
- **WHEN** a developer reads the primitives document
- **THEN** they SHALL find a clear explanation that `agent:` (prompt content source) and `delegate:` (execution path) are independent axes on a role, with an example showing both used together

#### Scenario: Migration guide present
- **WHEN** a developer has an existing flow with `orchestration: sequence` or `orchestration: parallel`
- **THEN** `docs/FLOW_PRIMITIVES.md` SHALL provide concrete before/after YAML showing how to remove the `orchestration:` field

### Requirement: AGENTS.md primitives section
The project `AGENTS.md` SHALL contain a **Flow Execution Primitives** reference section. It SHALL include: the schema→engine dispatch mapping table; the two orthogonal role axes table; `delegate: true` dispatch logic summary; context/skills inheritance chain; and a "Key Distinctions" callout listing what must NOT be confused.

#### Scenario: AI agent can determine engine method from YAML structure
- **WHEN** an AI agent reads `AGENTS.md` and encounters a `.flow.yaml` file
- **THEN** it SHALL be able to determine which engine method handles the flow using only the information in AGENTS.md, without reading flowEngine.ts

#### Scenario: AI agent understands agent vs delegate distinction
- **WHEN** an AI agent reads `AGENTS.md`
- **THEN** it SHALL find an explicit callout distinguishing `agent:` (content source) from `delegate: true` (execution path)
