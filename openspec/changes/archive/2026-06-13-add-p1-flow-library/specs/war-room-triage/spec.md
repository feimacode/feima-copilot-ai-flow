## ADDED Requirements

### Requirement: Staged flow for incident triage
The system SHALL provide a war-room triage flow with two stages: Stage 1 (parallel investigation) and Stage 2 (customer communication).

#### Scenario: Stage execution order
- **WHEN** user invokes war-room-triage flow with incident details
- **THEN** Stage 1 executes first (5 parallel analyst roles), Stage 2 executes second (Customer Communication role)

#### Scenario: Stage iteration
- **WHEN** Stage 1 completes
- **THEN** Stage 2 SHALL have access to all Stage 1 outputs

### Requirement: Incident Commander role (Stage 1)
The system SHALL provide an Incident Commander role that coordinates the investigation.

#### Scenario: Coordination
- **WHEN** Incident Commander receives incident details
- **THEN** it SHALL: establish incident scope, assign investigation areas, track analyst progress

#### Scenario: Output format
- **WHEN** Incident Commander completes coordination
- **THEN** it SHALL output: incident summary, investigation assignments, initial severity assessment

### Requirement: Recent Changes Analyst role (Stage 1)
The system SHALL provide a Recent Changes Analyst role that investigates deployment and change history.

#### Scenario: Change investigation
- **WHEN** Recent Changes Analyst receives incident details
- **THEN** it SHALL analyze: recent deployments, configuration changes, dependency updates, code changes

#### Scenario: Timeline correlation
- **WHEN** Recent Changes Analyst completes investigation
- **THEN** it SHALL output: change timeline, suspicious changes, correlation with incident onset

### Requirement: Application Layer Analyst role (Stage 1)
The system SHALL provide an Application Layer Analyst role that investigates application-level issues.

#### Scenario: Application investigation
- **WHEN** Application Layer Analyst receives incident details
- **THEN** it SHALL analyze: error logs, stack traces, application metrics, code paths

#### Scenario: Output format
- **WHEN** Application Layer Analyst completes investigation
- **THEN** it SHALL output: error patterns, suspected code paths, application-level findings

### Requirement: Infrastructure Layer Analyst role (Stage 1)
The system SHALL provide an Infrastructure Layer Analyst role that investigates infrastructure issues.

#### Scenario: Infrastructure investigation
- **WHEN** Infrastructure Layer Analyst receives incident details
- **THEN** it SHALL analyze: server health, network issues, resource utilization, container/pod status

#### Scenario: Output format
- **WHEN** Infrastructure Layer Analyst completes investigation
- **THEN** it SHALL output: infrastructure findings, resource bottlenecks, infrastructure alerts

### Requirement: Data Layer Analyst role (Stage 1)
The system SHALL provide a Data Layer Analyst role that investigates data and database issues.

#### Scenario: Data investigation
- **WHEN** Data Layer Analyst receives incident details
- **THEN** it SHALL analyze: slow queries, data corruption, connection issues, replication lag

#### Scenario: Output format
- **WHEN** Data Layer Analyst completes investigation
- **THEN** it SHALL output: data layer findings, query issues, data integrity concerns

### Requirement: Customer Communication role (Stage 2)
The system SHALL provide a Customer Communication role that synthesizes findings and prepares stakeholder communication.

#### Scenario: Communication synthesis
- **WHEN** Customer Communication receives all Stage 1 outputs
- **THEN** it SHALL synthesize: root cause hypothesis, impact assessment, customer-facing message

#### Scenario: Output format
- **WHEN** Customer Communication completes synthesis
- **THEN** it SHALL output: incident summary for stakeholders, recommended actions, customer communication draft

### Requirement: Extended tool set for investigation
The system SHALL provide analyst roles with investigation tools.

#### Scenario: Read tools
- **WHEN** any analyst role in Stage 1 executes
- **THEN** it SHALL have access to copilot_readFile and copilot_findTextInFiles tools

#### Scenario: Terminal tools
- **WHEN** any analyst role in Stage 1 executes
- **THEN** it SHALL have access to run_in_terminal and get_terminal_output tools for querying logs and diagnostics

### Requirement: Library discoverability
The system SHALL expose war-room-triage flow in the library with appropriate metadata.

#### Scenario: Category classification
- **WHEN** FlowLibrary scans examples/
- **THEN** war-room-triage.flow.yaml SHALL have category: "operations"

#### Scenario: Difficulty level
- **WHEN** FlowLibrary scans examples/
- **THEN** war-room-triage.flow.yaml SHALL have difficulty: "advanced"

#### Scenario: Tags for search
- **WHEN** FlowLibrary scans examples/
- **THEN** war-room-triage.flow.yaml SHALL have tags: ["incident", "triage", "war-room", "debugging", "production"]