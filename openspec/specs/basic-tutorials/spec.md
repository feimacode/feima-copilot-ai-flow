# basic-tutorials Specification

## Purpose
Provide 8 concept-first tutorials in the docs site that introduce flow primitives through minimal examples, gradual disclosure, and deep-link interactivity.

## Requirements

### Requirement: Hello, Flow tutorial
A `docs-site/src/content/docs/tutorials/hello-world.md` tutorial SHALL exist. It SHALL teach what a flow is using a 2-role `plan → edit` pattern. It SHALL explain `prompt:` and `sharedContext` as foundational concepts. It SHALL include a deep-link "Run in Copilot" button and a "Copy command" fallback. It SHALL reference `examples/hello-world.flow.yaml` as the companion file.

#### Scenario: User learns the core concept of a flow
- **WHEN** a new user reads the Hello, Flow tutorial
- **THEN** they SHALL understand that roles execute in sequence, each receiving the previous output

#### Scenario: User tries a flow via deep-link
- **WHEN** a user clicks "Run in Copilot" in the Hello, Flow tutorial
- **THEN** the `@flow #file:` invocation for `hello-world.flow.yaml` SHALL pre-fill in Copilot Chat

### Requirement: Pipeline Basics tutorial
A `docs-site/src/content/docs/tutorials/pipeline-basics.md` tutorial SHALL exist. It SHALL teach the `roles:` pattern with a 3-role flow (analyst → reviewer → summariser). It SHALL explain how output passes between roles. It SHALL include a practice section where users add `tools:` to the flow. It SHALL reference `examples/01-pipeline-review.flow.yaml`.

#### Scenario: User understands sequential role handoff
- **WHEN** a user reads the Pipeline Basics tutorial
- **THEN** they SHALL understand that each role sees the previous role's output as context

#### Scenario: User practices adding tools
- **WHEN** a user follows the practice section
- **THEN** they SHALL add an explicit `tools:` list to the example flow and run it

### Requirement: Iteration & Convergence tutorial
A `docs-site/src/content/docs/tutorials/iteration-convergence.md` tutorial SHALL exist. It SHALL teach `stages:`, `iterations:`, and the `<!-- flow:done -->` convergence sentinel. It SHALL explain when iteration is warranted vs. simple pipeline. It SHALL reference `examples/02-iterative-refine.flow.yaml`.

#### Scenario: User understands staged iteration
- **WHEN** a user reads the Iteration tutorial
- **THEN** they SHALL understand that stages loop roles and exit early via convergence sentinel

#### Scenario: User sees convergence in action
- **WHEN** a user runs the example iterative flow
- **THEN** they SHALL observe that the flow exits before max iterations when the `<!-- flow:done -->` sentinel is emitted

### Requirement: Fork-Join tutorial
A `docs-site/src/content/docs/tutorials/fork-join.md` tutorial SHALL exist. It SHALL teach `groups:` + `join:` with a 2-group flow (technical → business → synthesis). It SHALL explain when groups are truly independent and when fork-join is appropriate over pipeline. It SHALL reference `examples/03-fork-join-perspectives.flow.yaml`.

#### Scenario: User understands parallel execution
- **WHEN** a user reads the Fork-Join tutorial
- **THEN** they SHALL understand that groups run concurrently and the join role synthesises their outputs

### Requirement: Context Files tutorial
A `docs-site/src/content/docs/tutorials/context-files.md` tutorial SHALL exist. It SHALL teach `contexts:` for file injection and `sharedContext` for inline context. It SHALL explain token budget awareness — lower-priority elements are dropped first. It SHALL reference `examples/04-context-files.flow.yaml`.

#### Scenario: User injects context files into a flow
- **WHEN** a user follows the Context Files tutorial
- **THEN** they SHALL configure `contexts:` pointing to workspace files that are automatically injected into role context

#### Scenario: User understands token budget priority
- **WHEN** a user reads about token budget
- **THEN** they SHALL understand that context files are lower priority than role prompts and user query

### Requirement: Dialog Simulator tutorial
A `docs-site/src/content/docs/tutorials/dialog-simulator.md` tutorial SHALL exist. It SHALL teach fictional role simulation using a multi-persona dialog example (e.g., architect demoing a migration to a review board with dev lead, PM, and security officer roles). It SHALL reference `examples/05-dialog-simulator.flow.yaml`.

#### Scenario: User simulates multi-persona conversation
- **WHEN** a user runs the dialog simulator flow
- **THEN** fictional roles SHALL respond to each other's outputs, producing a realistic multi-perspective dialog

### Requirement: Tool Control tutorial
A `docs-site/src/content/docs/tutorials/tool-control.md` tutorial SHALL exist. It SHALL teach explicit `tools:` lists and how tool count affects context window size. It SHALL explain how to choose the right tools for a flow and the trade-off between capability and context efficiency. It SHALL include a practice section where users add explicit tools to flows from tutorials #1 and #2.

#### Scenario: User understands tool count impacts context
- **WHEN** a user reads the Tool Control tutorial
- **THEN** they SHALL understand that every tool reference consumes context window and that explicit lists prevent tool bloat

#### Scenario: User practices tool configuration
- **WHEN** a user follows the practice section
- **THEN** they SHALL configure an explicit `tools:` list on a previously tool-less flow

### Requirement: Human Gate tutorial
A `docs-site/src/content/docs/tutorials/human-gate.md` tutorial SHALL exist. It SHALL teach the `vscode_askQuestions` tool as the key primitive for structured human-in-the-loop gates. It SHALL explain how to construct effective questions with option labels, use a single tool invocation for all questions, and place the gate before downstream execution. It SHALL reference `examples/06-human-gate.flow.yaml`.

#### Scenario: User understands human-in-the-loop gating
- **WHEN** a user reads the Human Gate tutorial
- **THEN** they SHALL understand that `vscode_askQuestions` pauses execution, collects structured user input, and gates downstream roles

#### Scenario: User learns single-invocation question pattern
- **WHEN** a user reads about question construction
- **THEN** they SHALL learn to combine all questions into one `vscode_askQuestions` call with option labels rather than asking sequential questions
