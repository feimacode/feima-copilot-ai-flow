# flow-primitives-docs Specification

## Purpose
Provide user-facing documentation for flow execution primitives with use-case-driven guidance, separate from engine-internal architecture docs.

## Requirements

### Requirement: FLOW_PRIMITIVES.md human reference
A `src/docs/FLOW_PRIMITIVES.md` file SHALL exist in the repository. It SHALL cover: (1) the three structural patterns (pipeline, iterative, fork-join) with ASCII diagrams and minimal YAML examples; (2) the two role-level axes (prompt source and execution path) with an orthogonality explanation; (3) the inheritance chain for `skills:`, `contexts:`, and `tools:`; (4) a migration guide from the old `orchestration:` field. The document SHALL be written for a **user audience** — using use-case-driven decision guidance ("When to use pipeline vs. staged") rather than technical dispatch tables. Internal engine details (schema→engine dispatch mapping, `delegate: true` logic summary) SHALL remain in `AGENTS.md` and SHALL NOT appear in this user-facing document.

#### Scenario: All three structural patterns are documented with diagrams
- **WHEN** a user opens `src/docs/FLOW_PRIMITIVES.md`
- **THEN** they SHALL find an ASCII diagram and a minimal YAML example for each of `roles:` (pipeline), `stages:` (iterative), and `groups:`+`join:` (fork-join)

#### Scenario: Two-axis orthogonality is explained
- **WHEN** a user reads the primitives document
- **THEN** they SHALL find a clear explanation that `agent:` (prompt content source) and `delegate:` (execution path) are independent axes on a role, with an example showing both used together

#### Scenario: Migration guide present
- **WHEN** a user has an existing flow with `orchestration: sequence` or `orchestration: parallel`
- **THEN** `src/docs/FLOW_PRIMITIVES.md` SHALL provide concrete before/after YAML showing how to remove the `orchestration:` field

#### Scenario: Document is user-facing not engine-internal
- **WHEN** a user reads `src/docs/FLOW_PRIMITIVES.md`
- **THEN** the document SHALL NOT contain schema→engine dispatch tables, internal architecture references, or code-level implementation details

### Requirement: PROMPT_FILE_REFERENCES.md user guide
A `src/docs/PROMPT_FILE_REFERENCES.md` file SHALL exist in the repository. It SHALL cover: (1) the three reference methods (inline string, URI reference, filename reference) with concrete copy-pasteable YAML examples; (2) the file resolution order for filename references (`.github/prompts/`, `.vscode/prompts/`, `~/.copilot/prompts/`); (3) YAML frontmatter handling for prompt files; (4) how to combine `prompt:` and `agent:` references. The document SHALL be written for a **user audience** — a practical how-to guide, not a technical specification.

#### Scenario: User finds copy-pasteable examples for each reference method
- **WHEN** a user opens `src/docs/PROMPT_FILE_REFERENCES.md`
- **THEN** they SHALL find at least one concrete, copy-pasteable YAML example for each of inline, URI, and filename references

#### Scenario: File resolution order is documented
- **WHEN** a user needs to understand where filename references resolve
- **THEN** the document SHALL clearly list the search order: `.github/prompts/` → `.vscode/prompts/` → `~/.copilot/prompts/`

