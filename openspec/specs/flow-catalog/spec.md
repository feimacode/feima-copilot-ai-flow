# Flow Catalog Specification

## Purpose

Defines how the extension fetches, caches, and parses the harness catalog `index.json` to provide users with a browsable, searchable catalog of production-ready flows.

## Requirements

### Requirement: Fetch catalog index from GitHub

The system SHALL fetch the harness catalog `index.json` from the GitHub raw content URL and cache it locally for offline operation.

#### Scenario: Successful catalog fetch on activation

- **WHEN** the extension activates
- **THEN** system fetches `https://raw.githubusercontent.com/feimacode/feima-harness-catalog/main/index.json`
- **AND** system caches the response to `globalStorageUri/catalog/index.json`
- **AND** system parses the JSON and validates against catalog schema

#### Scenario: Catalog fetch fails, fallback to bundled version

- **WHEN** the GitHub fetch fails (network error, timeout, or invalid response)
- **THEN** system loads the bundled `assets/index.json` from the extension directory
- **AND** system logs a warning about using the bundled version

#### Scenario: Catalog fetch succeeds, update cached version

- **WHEN** the GitHub fetch succeeds
- **AND** the cached version is older than 24 hours or missing
- **THEN** system overwrites the cached file with the fresh response
- **AND** system updates the last-fetched timestamp

### Requirement: Refresh catalog on user request

The system SHALL allow users to force-refresh the catalog index from GitHub, bypassing the cache.

#### Scenario: User requests catalog refresh

- **WHEN** user runs `@flow /refresh` or clicks refresh in flow gallery
- **THEN** system fetches from GitHub ignoring cache age
- **AND** system updates the cached file regardless of freshness
- **AND** system notifies user of success or failure

#### Scenario: Refresh during offline operation

- **WHEN** user requests catalog refresh while offline
- **THEN** system attempts fetch and fails
- **AND** system continues using the most recent cached version
- **AND** system shows "Using cached catalog (offline)" message

### Requirement: Cache catalog with TTL

The system SHALL cache the catalog index with a configurable time-to-live (TTL) and respect the cache unless explicitly refreshed.

#### Scenario: Use cached catalog within TTL

- **WHEN** catalog is requested
- **AND** cached version exists and is less than 24 hours old
- **THEN** system returns cached version without fetching from GitHub

#### Scenario: Cache expired, fetch fresh version

- **WHEN** catalog is requested
- **AND** cached version is older than 24 hours or missing
- **THEN** system fetches fresh version from GitHub
- **AND** system updates cache with new version

### Requirement: Parse catalog index structure

The system SHALL parse the catalog index JSON and extract flows, skills, prompts, and provider metadata.

#### Scenario: Parse valid catalog index

- **WHEN** system loads a valid `index.json` file
- **THEN** system extracts all flows from the `flows` array
- **AND** system extracts all skills from the `skills` array
- **AND** system extracts all prompts from the `prompts` array
- **AND** system extracts provider information from `providers` array

#### Scenario: Handle malformed catalog index

- **WHEN** system loads an invalid or malformed `index.json` file
- **THEN** system logs an error with parsing details
- **AND** system falls back to bundled version if available
- **AND** system shows user-friendly error message

### Requirement: Validate catalog entry metadata

The system SHALL validate that each catalog entry has required fields (id, name, description, source, tags, orchestration, roles) before exposing it to users.

#### Scenario: Validate flow entry with all required fields

- **WHEN** system parses a flow entry from catalog
- **AND** entry has id, name, description, source, tags, orchestration, roles fields
- **THEN** system includes the flow in available flows list

#### Scenario: Skip flow entry with missing required fields

- **WHEN** system parses a flow entry from catalog
- **AND** entry is missing id or name or description or source field
- **THEN** system logs a warning about the malformed entry
- **AND** system excludes the flow from available flows list
