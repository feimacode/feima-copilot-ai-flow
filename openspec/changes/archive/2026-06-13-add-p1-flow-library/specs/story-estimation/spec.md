## ADDED Requirements

### Requirement: Four-role pipeline for story estimation
The system SHALL provide a story estimation flow with four sequential roles: Complexity Analyst, Risk & Unknowns Identifier, Dependency Mapper, and Estimator + Splitter.

#### Scenario: Pipeline execution order
- **WHEN** user invokes story-estimation flow with a user story or requirement
- **THEN** Complexity Analyst analyzes first, Risk & Unknowns Identifier second, Dependency Mapper third, Estimator + Splitter fourth

### Requirement: Complexity Analyst role
The system SHALL provide a Complexity Analyst role that assesses technical complexity and implementation difficulty.

#### Scenario: Complexity dimensions
- **WHEN** Complexity Analyst receives a story
- **THEN** it SHALL analyze: technical complexity, number of components affected, integration points, algorithm complexity

#### Scenario: Output format
- **WHEN** Complexity Analyst completes analysis
- **THEN** it SHALL output: complexity score (1-10), complexity breakdown by dimension, key technical challenges

### Requirement: Risk & Unknowns Identifier role
The system SHALL provide a Risk & Unknowns Identifier role that surfaces risks and areas requiring clarification.

#### Scenario: Risk identification
- **WHEN** Risk & Unknowns Identifier receives story and complexity analysis
- **THEN** it SHALL identify: technical risks, ambiguous requirements, missing specifications, unknown dependencies

#### Scenario: Question generation
- **WHEN** Risk & Unknowns Identifier identifies unknowns
- **THEN** it SHALL output: list of clarifying questions, risk severity ratings, assumptions needed

### Requirement: Dependency Mapper role
The system SHALL provide a Dependency Mapper role that identifies blocking dependencies and prerequisite work.

#### Scenario: Dependency mapping
- **WHEN** Dependency Mapper receives story and prior analyses
- **THEN** it SHALL identify: upstream dependencies, downstream impacts, blocking tasks, prerequisite stories

#### Scenario: Dependency visualization
- **WHEN** Dependency Mapper completes mapping
- **THEN** it SHALL output: dependency graph (text format), blocked-by list, blocks list, external dependencies

### Requirement: Estimator + Splitter role
The system SHALL provide an Estimator + Splitter role that produces final estimate and recommends story splitting if needed.

#### Scenario: Estimation synthesis
- **WHEN** Estimator + Splitter receives all prior analyses
- **THEN** it SHALL synthesize into: story points estimate, confidence level, splitting recommendation

#### Scenario: Split recommendation
- **WHEN** story complexity exceeds threshold
- **THEN** Estimator + Splitter SHALL recommend splitting into smaller stories with rationale

### Requirement: Minimal tool set
The system SHALL provide each role with minimal tools: readFile and findTextInFiles.

#### Scenario: Tool availability
- **WHEN** any role in story-estimation flow executes
- **THEN** it SHALL have access to copilot_readFile and copilot_findTextInFiles tools

### Requirement: Library discoverability
The system SHALL expose story-estimation flow in the library with appropriate metadata.

#### Scenario: Category classification
- **WHEN** FlowLibrary scans examples/
- **THEN** story-estimation.flow.yaml SHALL have category: "software-development", subcategory: "planning"

#### Scenario: Difficulty level
- **WHEN** FlowLibrary scans examples/
- **THEN** story-estimation.flow.yaml SHALL have difficulty: "intermediate"

#### Scenario: Tags for search
- **WHEN** FlowLibrary scans examples/
- **THEN** story-estimation.flow.yaml SHALL have tags: ["estimation", "sprint-planning", "agile", "story-points"]