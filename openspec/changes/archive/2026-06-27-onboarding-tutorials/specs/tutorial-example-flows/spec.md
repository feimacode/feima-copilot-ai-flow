# tutorial-example-flows Specification

## Purpose
Provide minimal, single-concept example `.flow.yaml` files shipped as builtin examples to support the basic tutorials.

## ADDED Requirements

### Requirement: hello-world example flow
An `examples/hello-world.flow.yaml` file SHALL exist in the repository. It SHALL contain a 2-role `plan → edit` flow with inline prompts and a `sharedContext` section following the standardized template (What This Does, When to Use, How It Works, Example, What You'll Get, Customize It). The difficulty SHALL be `beginner`. It SHALL use no tools by default.

#### Scenario: User opens hello-world.flow.yaml
- **WHEN** a user opens `examples/hello-world.flow.yaml`
- **THEN** they SHALL see a complete, runnable 2-role flow demonstrating the core concept of sequential role execution

#### Scenario: hello-world lists in gallery
- **WHEN** the flow gallery is opened
- **THEN** `hello-world` SHALL appear as a builtin flow with difficulty `beginner`

### Requirement: 01-pipeline-review example flow
An `examples/01-pipeline-review.flow.yaml` file SHALL exist in the repository. It SHALL contain a 3-role pipeline flow (Analyst → Reviewer → Summariser) with distinct perspectives for each role. The difficulty SHALL be `beginner`. The `sharedContext` SHALL follow the standardized template.

#### Scenario: User opens 01-pipeline-review.flow.yaml
- **WHEN** a user opens `examples/01-pipeline-review.flow.yaml`
- **THEN** they SHALL see a 3-role pipeline demonstrating sequential handoff with distinct role perspectives

### Requirement: 02-iterative-refine example flow
An `examples/02-iterative-refine.flow.yaml` file SHALL exist in the repository. It SHALL contain a single stage with 2 roles (Writer → Critic) configured for 3 iterations with the `<!-- flow:done -->` convergence sentinel in the Critic's prompt. The difficulty SHALL be `beginner`.

#### Scenario: User opens 02-iterative-refine.flow.yaml
- **WHEN** a user opens `examples/02-iterative-refine.flow.yaml`
- **THEN** they SHALL see a staged flow with convergence sentinel demonstrating iterative refinement

### Requirement: 03-fork-join-perspectives example flow
An `examples/03-fork-join-perspectives.flow.yaml` file SHALL exist in the repository. It SHALL contain 2 groups (Technical and Business) with 1 role each, and a join role (Synthesiser). The difficulty SHALL be `beginner`.

#### Scenario: User opens 03-fork-join-perspectives.flow.yaml
- **WHEN** a user opens `examples/03-fork-join-perspectives.flow.yaml`
- **THEN** they SHALL see a fork-join flow with 2 parallel groups and a join role

### Requirement: 04-context-files example flow
An `examples/04-context-files.flow.yaml` file SHALL exist in the repository. It SHALL contain a single role with `contexts:` referencing project files and a `sharedContext` explaining the token budget priority. The difficulty SHALL be `beginner`.

#### Scenario: User opens 04-context-files.flow.yaml
- **WHEN** a user opens `examples/04-context-files.flow.yaml`
- **THEN** they SHALL see how `contexts:` injects file content into role context

### Requirement: 05-dialog-simulator example flow
An `examples/05-dialog-simulator.flow.yaml` file SHALL exist in the repository. It SHALL contain a 3+ role pipeline where roles represent fictional personas (e.g., Architect, Dev Lead, Project Manager) engaged in a structured discussion. The difficulty SHALL be `beginner`.

#### Scenario: User opens 05-dialog-simulator.flow.yaml
- **WHEN** a user opens `examples/05-dialog-simulator.flow.yaml`
- **THEN** they SHALL see a flow where fictional roles simulate a multi-perspective conversation

### Requirement: 06-human-gate example flow
An `examples/06-human-gate.flow.yaml` file SHALL exist in the repository. It SHALL contain a 2-role pipeline where the first role uses `vscode_askQuestions` to gather structured input, and the second role acts on the gathered information. The difficulty SHALL be `beginner`. The `tools:` list SHALL include `vscode_askQuestions`.

#### Scenario: User opens 06-human-gate.flow.yaml
- **WHEN** a user opens `examples/06-human-gate.flow.yaml`
- **THEN** they SHALL see a flow demonstrating the human gate pattern with `vscode_askQuestions`

### Requirement: Archive existing feature-demo flows
The following files SHALL be removed from `examples/`: `agent-file-demo.flow.yaml`, `cli-autonomous-worktree.flow.yaml`, `hybrid-prompt-agent-demo.flow.yaml`, `prompt-file-demo.flow.yaml`. Their concepts SHALL be covered by the new tutorials and the existing `referencing-files` guide.

#### Scenario: Deprecated demos no longer appear as builtin flows
- **WHEN** the gallery is opened after this change
- **THEN** `agent-file-demo`, `cli-autonomous-worktree`, `hybrid-prompt-agent-demo`, and `prompt-file-demo` SHALL NOT appear as builtin flows

#### Scenario: Referencing concepts are still documented
- **WHEN** a user needs to learn about prompt file references or agent files
- **THEN** they SHALL find coverage in the `referencing-files` guide and the relevant basic tutorials
