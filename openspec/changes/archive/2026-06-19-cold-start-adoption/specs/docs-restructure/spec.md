## ADDED Requirements

### Requirement: Engine docs moved to src/docs/
The following files SHALL be moved from `docs/` to `src/docs/`: `FLOW_SCHEMA.md`, `CONTEXT_SYSTEM.md`, `CATALOG_ECOSYSTEM.md`, `flow-backlog.md`, `VIRTUAL_TEAM_ROADMAP.md`, `11-cli-delegation-background-agents.md`. The files SHALL be moved as-is without content changes.

#### Scenario: Engine contributor finds architecture docs alongside code
- **WHEN** a developer browses `src/docs/`
- **THEN** they SHALL find all 6 engine-internal documents adjacent to the source code they describe

#### Scenario: User-facing docs/ is clean
- **WHEN** a user browses `docs/`
- **THEN** the folder SHALL contain only user-facing content (guides, references), NOT engine architecture or roadmap documents

### Requirement: Empty stub files removed
The files `docs/REDHAT_YAML_DEFAULT_SCHEMA.md` and `docs/REDHAT_YAML_SUMMARY.md` SHALL be deleted.

#### Scenario: No broken docs visible
- **WHEN** a user or developer browses the repository
- **THEN** no empty or placeholder documentation files SHALL exist in `docs/`

### Requirement: README restructured as user-first
The `README.md` SHALL be restructured with the following section order: (1) Hero — what and why in 1-2 sentences with demo visual, (2) Quick Start — copy-paste invocation yielding first value in under 60 seconds, (3) What You Can Do — use-case-driven, not feature-driven, (4) Built-in Flows — table with one-line descriptions and "Run this" links, (5) Features — condensed feature list, (6) For Developers — build, test, architecture. Each built-in flow in the table SHALL include a deep-link "Run in Copilot" button using the `vscode://github.copilot-chat/chat?prompt=...` URI scheme.

#### Scenario: Cold-start user finds value in 60 seconds
- **WHEN** a new user reads the README
- **THEN** they SHALL be able to copy-paste a single `@flow` invocation and see results within 60 seconds

#### Scenario: Developer finds architecture information
- **WHEN** a developer scrolls to the "For Developers" section
- **THEN** they SHALL find build commands, test instructions, and architecture overview

### Requirement: All P1 flows self-documenting via sharedContext
The following P1 production flows SHALL include a `sharedContext` section following the standardized template: `backlog-ranking.flow.yaml`, `pr-description.flow.yaml`, `test-writing.flow.yaml`. The `sequence-basic.flow.yaml` demo flow SHALL also include `sharedContext`. The template SHALL include: ## What This Does, ## When to Use, ## How It Works, ## Example (with copy-pasteable `@flow` invocation), ## What You'll Get, ## Customize It.

#### Scenario: User reads a flow file and understands it
- **WHEN** a user opens any P1 production flow YAML file
- **THEN** the `sharedContext` field SHALL explain what the flow does, when to use it, how it works, and how to customize it

#### Scenario: Flow is self-documenting without external docs
- **WHEN** a user discovers a flow via the gallery or GitHub
- **THEN** they SHALL be able to understand and run the flow without consulting separate documentation
