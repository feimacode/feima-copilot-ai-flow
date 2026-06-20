# Flow Installation Specification

## Purpose

Defines how users can install flows from the catalog to their workspace, including duplicate detection, overwrite handling, companion reporting, and error handling for fetch failures.

## Requirements

### Requirement: Install catalog flow to workspace

The system SHALL allow users to download and install a catalog flow to their workspace's `.github/flows/` directory.

#### Scenario: Install flow from catalog

- **WHEN** user runs `@flow /install <flow-id>`
- **AND** flow exists in catalog with a valid source URI
- **THEN** system resolves the source URI to a raw content URL
- **AND** system fetches the flow YAML file from the resolved URL
- **AND** system writes the file to `.github/flows/<flow-id>.flow.yaml`
- **AND** system confirms installation with success message

#### Scenario: Install flow with gist source

- **WHEN** catalog entry has `source: "gist:abc123"`
- **THEN** system fetches from `https://gist.githubusercontent.com/abc123/raw`
- **AND** system writes the fetched content to `.github/flows/`

#### Scenario: Install flow with GitHub source

- **WHEN** catalog entry has `source: "github:owner/repo/path/flow.flow.yaml"`
- **THEN** system fetches from `https://raw.githubusercontent.com/owner/repo/main/path/flow.flow.yaml`
- **AND** system writes the fetched content to `.github/flows/`

### Requirement: Prevent duplicate installation

The system SHALL prevent installing a flow that already exists in the workspace `.github/flows/` directory.

#### Scenario: Attempt to install existing flow

- **WHEN** user runs `@flow /install <flow-id>`
- **AND** a file named `<flow-id>.flow.yaml` already exists in `.github/flows/`
- **THEN** system shows error message: "Flow already installed"
- **AND** system offers option to overwrite with confirmation

#### Scenario: Overwrite existing flow with confirmation

- **WHEN** user confirms overwrite of existing flow
- **THEN** system replaces the existing file with the catalog version
- **AND** system confirms successful overwrite

### Requirement: Handle flow fetch failure

The system SHALL gracefully handle failures when fetching flow YAML from the source URI.

#### Scenario: Flow fetch fails with network error

- **WHEN** system attempts to fetch flow YAML from source URI
- **AND** network request fails (timeout, DNS error, connection refused)
- **THEN** system shows user-friendly error message
- **AND** system does not create a partial file in `.github/flows/`

#### Scenario: Flow fetch returns invalid YAML

- **WHEN** system successfully fetches flow YAML content
- **AND** the content is not valid YAML or does not match flow schema
- **THEN** system shows validation error with details
- **AND** system does not write the invalid file to `.github/flows/`

### Requirement: Resolve companion references

The system SHALL identify and report companion skills, prompts, and agents referenced by the installed flow.

#### Scenario: Flow uses skills from catalog

- **WHEN** installed flow has `uses_skills: ["auto-test", "contract-test"]`
- **AND** those skills exist in the catalog
- **THEN** system shows message: "This flow uses skills: auto-test, contract-test"
- **AND** system offers to install companion skills if not already available

#### Scenario: Flow uses agents from catalog

- **WHEN** installed flow has `uses_prompts: ["incident-commander"]`
- **AND** that agent exists in the catalog
- **THEN** system shows message: "This flow uses agent: incident-commander"
- **AND** system offers to install companion agent if not already available

#### Scenario: Companion references not found in catalog

- **WHEN** installed flow references a skill or agent that does not exist in catalog
- **THEN** system shows warning: "Companion 'xyz' not found in catalog"
- **AND** system completes flow installation
- **AND** system advises user to ensure companions are available via other means

### Requirement: Create target directory if missing

The system SHALL create the `.github/flows/` directory if it does not exist in the workspace.

#### Scenario: Install flow to workspace without flows directory

- **WHEN** user runs `@flow /install <flow-id>`
- **AND** `.github/flows/` directory does not exist in workspace
- **THEN** system creates `.github/flows/` directory
- **AND** system installs the flow file to the newly created directory
