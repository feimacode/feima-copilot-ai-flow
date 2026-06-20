# Index Bundling Specification

## ADDED Requirements

### Requirement: Fetch index.json at build time

The system SHALL fetch the latest `index.json` from the harness catalog during the VSIX build process and bundle it in the extension assets.

#### Scenario: Build pipeline fetches fresh index

- **WHEN** VSIX build runs in GitHub Actions
- **THEN** build step fetches `https://raw.githubusercontent.com/feimacode/feima-harness-catalog/main/index.json`
- **AND** build step writes the fetched content to `assets/index.json`
- **AND** build step includes `assets/index.json` in the VSIX package

#### Scenario: Build fails if index fetch fails

- **WHEN** VSIX build runs
- **AND** index.json fetch fails (network error, timeout, or invalid response)
- **THEN** build step fails with clear error message
- **AND** build does not proceed to packaging

#### Scenario: Build validates index.json structure

- **WHEN** build step fetches index.json
- **THEN** build step validates the JSON against catalog schema
- **AND** build step fails if validation fails
- **AND** build step logs validation errors for debugging

### Requirement: Bundle index.json in VSIX assets

The system SHALL include the bundled `index.json` file in the VSIX package so it's available at extension activation time.

#### Scenario: VSIX contains bundled index

- **WHEN** VSIX is built and installed
- **THEN** `assets/index.json` is included in the extension directory
- **AND** extension can read the file at `context.extensionPath/assets/index.json`

#### Scenario: Bundled index is used as fallback

- **WHEN** extension activates and cannot fetch fresh index from GitHub
- **THEN** extension loads the bundled `assets/index.json`
- **AND** extension uses the bundled version as the initial catalog

### Requirement: Support offline operation with bundled index

The system SHALL allow full catalog functionality using only the bundled index when offline or when GitHub fetch fails.

#### Scenario: Browse flows using bundled index

- **WHEN** user runs `@flow /browse` while offline
- **AND** extension cannot fetch fresh index from GitHub
- **THEN** extension shows flows from the bundled index
- **AND** all catalog functionality works (browse, search, install)

#### Scenario: Install flow using bundled index

- **WHEN** user runs `@flow /install <flow-id>` while offline
- **AND** flow exists in bundled index
- **THEN** extension installs the flow using the bundled metadata
- **AND** extension fetches flow YAML from the source URI (may fail if also offline)

#### Scenario: Bundle index is stale but functional

- **WHEN** bundled index is older than the live catalog
- **AND** extension cannot fetch fresh version
- **THEN** extension uses the stale bundled index
- **AND** extension shows warning: "Using cached catalog (may be outdated)"

### Requirement: Version bundled index for debugging

The system SHALL include the timestamp and version from the bundled index for debugging and user awareness.

#### Scenario: Display bundled index metadata

- **WHEN** extension loads the bundled index
- **THEN** extension logs the `updated` timestamp from the index
- **AND** extension logs the `version` field from the index

#### Scenario: User can check bundled index age

- **WHEN** user runs `@flow /status`
- **THEN** extension shows:
  - Catalog source being used (bundled vs. cached vs. fresh)
  - Last updated timestamp
  - Version number
  - Age of the catalog data

### Requirement: Rebuild index on catalog schema changes

The system SHALL detect when the catalog schema changes and require a rebuild of the bundled index.

#### Scenario: Catalog schema version changes

- **WHEN` catalog index has a new `version` field value
- **AND` bundled index has older version
- **THEN** extension logs warning about schema version mismatch
- **AND** extension recommends updating the extension to get fresh bundled index

#### Scenario: Build fails on unknown schema version

- **WHEN** build step fetches index.json
- **AND` index has `version` field that extension doesn't recognize
- **THEN** build step fails with error about unsupported schema version
- **AND` build step recommends updating extension code to support new version