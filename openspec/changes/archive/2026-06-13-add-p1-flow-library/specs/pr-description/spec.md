## ADDED Requirements

### Requirement: Three-role pipeline for PR description generation
The system SHALL provide a PR description flow with three sequential roles: Code Historian, Impact Assessor, and PR Writer.

#### Scenario: Pipeline execution order
- **WHEN** user invokes pr-description flow with a diff or commit reference
- **THEN** Code Historian analyzes first, Impact Assessor second, PR Writer third

### Requirement: Code Historian role
The system SHALL provide a Code Historian role that analyzes what changed and why.

#### Scenario: Change analysis
- **WHEN** Code Historian receives diff or commits
- **THEN** it SHALL analyze: what changed, why it changed (intent), related context

#### Scenario: Intent-first framing
- **WHEN** Code Historian analyzes changes
- **THEN** it SHALL focus on intent and rationale, not just change description

#### Scenario: Output format
- **WHEN** Code Historian completes analysis
- **THEN** it SHALL output: change summary, intent rationale, related files/components

### Requirement: Impact Assessor role
The system SHALL provide an Impact Assessor role that assesses potential impacts and risks.

#### Scenario: Impact analysis
- **WHEN** Impact Assessor receives change analysis
- **THEN** it SHALL analyze: what can break, who's affected, breaking changes, migration needs

#### Scenario: Breaking change detection
- **WHEN** Impact Assessor identifies breaking changes
- **THEN** it SHALL flag them explicitly with severity and affected users/systems

#### Scenario: Output format
- **WHEN** Impact Assessor completes analysis
- **THEN** it SHALL output: impact areas, risk assessment, breaking changes list, affected stakeholders

### Requirement: PR Writer role
The system SHALL provide a PR Writer role that composes the final PR description.

#### Scenario: Description composition
- **WHEN** PR Writer receives historian and assessor outputs
- **THEN** it SHALL compose: title, summary, changes list, testing notes, breaking changes section

#### Scenario: Standard format
- **WHEN** PR Writer composes description
- **THEN** it SHALL follow conventional PR description format with clear sections

#### Scenario: Output format
- **WHEN** PR Writer completes composition
- **THEN** it SHALL output: complete PR description in markdown format

### Requirement: Minimal tool set
The system SHALL provide roles with minimal read tools.

#### Scenario: Read tools
- **WHEN** any role in pr-description flow executes
- **THEN** it SHALL have access to copilot_readFile tool

#### Scenario: No search tools
- **WHEN** any role in pr-description flow executes
- **THEN** it SHALL NOT require findTextInFiles (focus on provided diff)

### Requirement: Library discoverability
The system SHALL expose pr-description flow in the library with appropriate metadata.

#### Scenario: Category classification
- **WHEN** FlowLibrary scans examples/
- **THEN** pr-description.flow.yaml SHALL have category: "software-development"

#### Scenario: Difficulty level
- **WHEN** FlowLibrary scans examples/
- **THEN** pr-description.flow.yaml SHALL have difficulty: "beginner"

#### Scenario: Tags for search
- **WHEN** FlowLibrary scans examples/
- **THEN** pr-description.flow.yaml SHALL have tags: ["pr", "pull-request", "description", "documentation"]