# advanced-tutorials Specification

## Purpose
Provide 4 tutorials in the docs site from the flow author's perspective, teaching design patterns extracted from production flows.

## ADDED Requirements

### Requirement: Quality Gates tutorial
A `docs-site/src/content/docs/tutorials/quality-gates.md` tutorial SHALL exist. It SHALL teach three quality-building patterns: (1) Human Gate — `vscode_askQuestions` before execution, (2) Critic Loop — staged iteration where a critic role validates output before proceeding, (3) Adversarial Role — a dedicated role that challenges the output. The tutorial SHALL reference production flows `war-room-triage.flow.yaml`, `sdd-openspec-full-cycle.flow.yaml`, and `test-writing.flow.yaml`. It SHALL use a "naive → improved" progression showing why each pattern is needed.

#### Scenario: User learns the human gate pattern at design level
- **WHEN** a user reads the Quality Gates tutorial
- **THEN** they SHALL understand when to insert a human gate role before downstream execution, not just how to use the tool

#### Scenario: User learns the critic loop pattern
- **WHEN** a user reads about the critic loop
- **THEN** they SHALL understand that a staged role that validates the output and requests revisions improves quality over single-pass pipelines

#### Scenario: User learns the adversarial role pattern
- **WHEN** a user reads about the adversarial role
- **THEN** they SHALL understand that a role whose purpose is to challenge and break the output reveals coverage gaps

### Requirement: Efficiency Patterns tutorial
A `docs-site/src/content/docs/tutorials/efficiency-patterns.md` tutorial SHALL exist. It SHALL teach three efficiency patterns: (1) Tool Strategy — choosing minimal tool sets per role vs. per flow, (2) Context Budget — using `sharedContext`, `contexts:`, and prompt compactness to stay within token limits, (3) Skills Integration — using skill references to inject domain knowledge without bloating prompts. It SHALL reference production flows `code-review.flow.yaml`, `backlog-ranking.flow.yaml`, and `sdd-openspec-full-cycle.flow.yaml`.

#### Scenario: User learns tool strategy as a design decision
- **WHEN** a user reads the Efficiency Patterns tutorial
- **THEN** they SHALL understand that tool count per role is a deliberate design choice balancing capability against context cost

#### Scenario: User learns context budget management
- **WHEN** a user reads about context budget
- **THEN** they SHALL understand the priority ladder (system prompt > user query > editor context > history > context files) and how to trim lower-priority elements

#### Scenario: User learns skills integration
- **WHEN** a user reads about skills
- **THEN** they SHALL understand how to reference skill files that inject domain knowledge without copying it into every role prompt

### Requirement: Autonomous Design tutorial
A `docs-site/src/content/docs/tutorials/autonomous-design.md` tutorial SHALL exist. It SHALL teach: (1) When to use `delegate: true` vs. VS Code LM API, (2) Worktree isolation for safe background execution, (3) Composing human gates with delegation — the tension between `vscode_askQuestions` (requires human) and `delegate: true` (background execution). It SHALL reference production flows `cli-autonomous-worktree.flow.yaml` and `sdd-openspec-full-cycle.flow.yaml`.

#### Scenario: User learns delegation design judgment
- **WHEN** a user reads the Autonomous Design tutorial
- **THEN** they SHALL understand that `delegate: true` is appropriate for long-running, unattended roles but incompatible with `vscode_askQuestions`

#### Scenario: User learns worktree isolation
- **WHEN** a user reads about worktree isolation
- **THEN** they SHALL understand that isolated worktrees prevent delegated role changes from affecting the working directory

#### Scenario: User learns to compose gates with delegation
- **WHEN** a user reads about composition
- **THEN** they SHALL understand that a pre-delegation human gate followed by delegated autonomous roles is a valid composition pattern

### Requirement: Case Study: Full-Cycle Flow Design tutorial
A `docs-site/src/content/docs/tutorials/case-study-full-cycle.md` tutorial SHALL exist. It SHALL walk through designing a complete flow from requirements to final YAML, using `sdd-openspec-full-cycle.flow.yaml` as the reference example. It SHALL explain each design decision: why staged not pipeline, why a critic not just more iterations, why skills not inline prompts, why single human gate at the front. It SHALL show the full flow YAML with annotations explaining the rationale for each structural choice.

#### Scenario: User follows a complete flow design walkthrough
- **WHEN** a user reads the Case Study tutorial
- **THEN** they SHALL understand the design decisions behind a complex production flow, including structural pattern choice, role decomposition, skill selection, and gate placement
