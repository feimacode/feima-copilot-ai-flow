# docs-site Delta Specification

## MODIFIED Requirements

### Requirement: Docs site content structure
The docs site SHALL include the following sections: (1) Getting Started — installation and quickstart (first flow in 60 seconds), (2) Tutorials — organized in three groups: Basic (8 concept-first tutorials: hello-world, pipeline-basics, iteration-convergence, fork-join, context-files, dialog-simulator, tool-control, human-gate), In Practice (5 domain-thread tutorials: your-first-flow, customize-flow, jira-integration, staged-iteration, cli-delegation), Advanced (4 flow-author tutorials: quality-gates, efficiency-patterns, autonomous-design, case-study-full-cycle), (3) Guides — execution patterns, referencing files, flow authoring concepts, tool integration, (4) Gallery — links to in-editor gallery and key example flows.

#### Scenario: Tutorials are organized in three groups
- **WHEN** a user browses the docs site sidebar
- **THEN** the Tutorials section SHALL display three collapsible groups: Basic, In Practice, and Advanced

#### Scenario: Basic tutorials teach concepts first
- **WHEN** a user follows the Basic tutorial chain from beginning to end
- **THEN** the first tutorial SHALL teach "what a flow is" before any YAML authoring, and each subsequent tutorial SHALL introduce one new concept with a minimal example flow

#### Scenario: Advanced tutorials teach design patterns
- **WHEN** a user reads the Advanced tutorials
- **THEN** they SHALL learn design patterns extracted from production flows with "naive → improved" progressions
