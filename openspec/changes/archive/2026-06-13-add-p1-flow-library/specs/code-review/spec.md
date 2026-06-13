## ADDED Requirements

### Requirement: Three-role pipeline for code review
The system SHALL provide a code review flow with three sequential roles: Logic & Correctness Reviewer, Style & Security Reviewer, and Verdict.

#### Scenario: Pipeline execution order
- **WHEN** user invokes code-review flow with a code snippet or file reference
- **THEN** Logic & Correctness Reviewer analyzes first, Style & Security Reviewer analyzes second, Verdict synthesizes third

#### Scenario: Role output visibility
- **WHEN** each role completes its analysis
- **THEN** the next role can see the previous role's output in its context

### Requirement: Logic & Correctness Reviewer role
The system SHALL provide a Logic & Correctness Reviewer role that focuses on algorithm correctness, edge cases, and logical errors.

#### Scenario: Correctness analysis
- **WHEN** Logic & Correctness Reviewer receives code
- **THEN** it SHALL analyze for: algorithm correctness, edge case handling, logical errors, boundary conditions

#### Scenario: Output format
- **WHEN** Logic & Correctness Reviewer completes analysis
- **THEN** it SHALL output findings in a structured format with severity, finding description, and location

### Requirement: Style & Security Reviewer role
The system SHALL provide a Style & Security Reviewer role that focuses on code style, security vulnerabilities, and best practices.

#### Scenario: Security analysis
- **WHEN** Style & Security Reviewer receives code and previous reviewer's output
- **THEN** it SHALL analyze for: security vulnerabilities, OWASP patterns, input validation, authentication/authorization issues

#### Scenario: Style analysis
- **WHEN** Style & Security Reviewer receives code
- **THEN** it SHALL analyze for: naming conventions, code organization, readability, maintainability

### Requirement: Verdict role
The system SHALL provide a Verdict role that synthesizes findings and produces actionable recommendations.

#### Scenario: Verdict synthesis
- **WHEN** Verdict receives outputs from both reviewers
- **THEN** it SHALL synthesize findings into prioritized recommendations

#### Scenario: Actionable output
- **WHEN** Verdict completes synthesis
- **THEN** it SHALL output: summary of critical issues, recommended actions with priority, overall assessment

### Requirement: Minimal tool set
The system SHALL provide each role with minimal tools: readFile and findTextInFiles.

#### Scenario: Tool availability
- **WHEN** any role in code-review flow executes
- **THEN** it SHALL have access to copilot_readFile and copilot_findTextInFiles tools

#### Scenario: No write tools
- **WHEN** any role in code-review flow executes
- **THEN** it SHALL NOT have access to createFile or replaceString tools

### Requirement: Library discoverability
The system SHALL expose code-review flow in the library with appropriate metadata.

#### Scenario: Category classification
- **WHEN** FlowLibrary scans examples/
- **THEN** code-review.flow.yaml SHALL have category: "software-development"

#### Scenario: Difficulty level
- **WHEN** FlowLibrary scans examples/
- **THEN** code-review.flow.yaml SHALL have difficulty: "beginner"

#### Scenario: Tags for search
- **WHEN** FlowLibrary scans examples/
- **THEN** code-review.flow.yaml SHALL have tags: ["code-review", "quality", "security", "beginner"]