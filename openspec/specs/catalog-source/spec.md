# Catalog Source Specification

## Purpose

Defines how catalog flows are converted to IFlowEntry objects, how flows from builtin, catalog, and workspace sources are merged with precedence, and how search/browse/install work across all sources.

## Requirements

### Requirement: Convert catalog flows to IFlowEntry objects

The system SHALL parse catalog flow entries and convert them to `IFlowEntry` objects compatible with the existing flow library.

#### Scenario: Convert valid catalog flow entry

- **WHEN** system processes a catalog flow entry
- **THEN** system creates an `IFlowEntry` with:
  - `id` from catalog entry's `id` field
  - `name` from catalog entry's `name` field
  - `description` from catalog entry's `description` field
  - `source` set to `'catalog'`
  - `sourceUri` set to catalog entry's `source` field
  - `orchestration` from catalog entry's `orchestration` field
  - `roleCount` from catalog entry's `roles` field
  - `provider` from catalog entry's `provider` field
  - `trust` from catalog entry's `trust` field
  - `filePath` set to `undefined` (not yet installed)

#### Scenario: Include optional metadata from catalog

- **WHEN** catalog flow entry has optional fields
- **THEN** system includes `category`, `subcategory`, `tags`, `difficulty`, `version`, `author` in `IFlowEntry` if present

#### Scenario: Handle catalog entry with missing optional fields

- **WHEN** catalog flow entry is missing optional metadata fields
- **THEN** system creates `IFlowEntry` with only required fields populated
- **AND** system sets missing fields to `undefined`

### Requirement: Merge builtin, catalog, and workspace flows

The system SHALL merge flows from builtin source, catalog source, and workspace source, with workspace flows taking highest precedence, followed by catalog, then builtin.

#### Scenario: Merge with no conflicts

- **WHEN** catalog has flow `code-review` and workspace has no flow with that id
- **THEN** system includes the catalog `code-review` flow in merged results
- **AND** system marks it as `source: 'catalog'`

#### Scenario: Workspace flow overrides catalog flow

- **WHEN** catalog has flow `code-review` and workspace has `code-review.flow.yaml` installed
- **THEN** system includes the workspace `code-review` flow in merged results
- **AND** system marks it as `source: 'workspace'`
- **AND** system excludes the catalog version from results

#### Scenario: Workspace flow overrides builtin flow

- **WHEN** builtin has flow `war-room-triage` and workspace has `war-room-triage.flow.yaml` installed
- **THEN** system includes the workspace `war-room-triage` flow in merged results
- **AND** system marks it as `source: 'workspace'`
- **AND** system excludes the builtin version from results

#### Scenario: Catalog flow overrides builtin flow

- **WHEN** builtin has flow `code-review` and catalog has flow `code-review` (same id)
- **AND** workspace has no flow with that id
- **THEN** system includes the catalog `code-review` flow in merged results
- **AND** system marks it as `source: 'catalog'`
- **AND** system excludes the builtin version from results

#### Scenario: Builtin-only flows remain discoverable

- **WHEN** workspace has no flows installed
- **AND** catalog has no flow with a given id
- **THEN** system shows builtin flows in `/browse` results
- **AND** system marks them as `source: 'builtin'`

### Requirement: Search across builtin, catalog, and workspace flows

The system SHALL search for flows by name, description, tags, category, and id across builtin, catalog, and workspace sources.

#### Scenario: Search finds catalog flow

- **WHEN** user runs `@flow /search incident`
- **AND** catalog has flow `war-room-triage` with tag "incident"
- **THEN** system includes `war-room-triage` in search results
- **AND** system shows it as `[catalog] war-room-triage`

#### Scenario: Search finds workspace flow

- **WHEN** user runs `@flow /search incident`
- **AND** workspace has `my-incident-flow.flow.yaml` with tag "incident"
- **THEN** system includes `my-incident-flow` in search results
- **AND** system shows it as `[workspace] my-incident-flow`

#### Scenario: Search finds builtin flow

- **WHEN** user runs `@flow /search code-review`
- **AND** builtin has `code-review.flow.yaml` with tag "code-review"
- **THEN** system includes `code-review` in search results
- **AND** system shows it as `[builtin] code-review`

#### Scenario: Search finds flows from all sources

- **WHEN** user runs `@flow /search code-review`
- **AND** builtin has `code-review` flow
- **AND** catalog has `code-review` flow
- **AND** workspace has `custom-code-review.flow.yaml` flow
- **THEN** system shows all three flows in search results
- **AND** system labels each with its source
- **AND** system shows workspace flow first, then catalog, then builtin (precedence order)

### Requirement: Filter flows by source

The system SHALL allow filtering flows by source type (builtin, catalog, workspace, or all).

#### Scenario: Show only catalog flows

- **WHEN** user runs `@flow /browse --source catalog`
- **THEN** system shows only flows from catalog source
- **AND** system excludes builtin and workspace flows from results

#### Scenario: Show only workspace flows

- **WHEN** user runs `@flow /browse --source workspace`
- **THEN** system shows only flows from `.github/flows/` directory
- **AND** system excludes builtin and catalog flows from results

#### Scenario: Show only builtin flows

- **WHEN** user runs `@flow /browse --source builtin`
- **THEN** system shows only flows from `examples/` directory
- **AND** system excludes catalog and workspace flows from results

#### Scenario: Show all flows (default)

- **WHEN** user runs `@flow /browse` without source filter
- **THEN** system shows builtin, catalog, and workspace flows
- **AND** system merges results with workspace first, then catalog, then builtin

### Requirement: Display flow metadata in browse results

The system SHALL display rich metadata for all flows in browse results, with source-appropriate information.

#### Scenario: Browse shows catalog flow metadata

- **WHEN** user runs `@flow /browse`
- **AND** results include catalog flow `war-room-triage`
- **THEN** system displays:
  - `[official]` or `[community]` trust badge
  - Provider name: `feima-awesome-harness`
  - Orchestration: `staged`
  - Role count: `8`
  - Description text
  - Tags list

#### Scenario: Browse shows workspace flow with minimal metadata

- **WHEN** user runs `@flow /browse`
- **AND** results include workspace flow `my-flow.flow.yaml`
- **THEN** system displays:
  - `[workspace]` badge
  - Flow name from file or metadata
  - Description if present in YAML frontmatter
  - No provider or trust level (not applicable)

#### Scenario: Browse shows builtin flow with metadata

- **WHEN** user runs `@flow /browse`
- **AND** results include builtin flow `code-review.flow.yaml`
- **THEN** system displays:
  - `[builtin]` badge
  - Flow name from YAML metadata
  - Description, category, tags from YAML frontmatter
  - No provider or trust level (built-in)

### Requirement: Install builtin flows to workspace

The system SHALL allow users to copy builtin flows from `examples/` to their workspace `.github/flows/` directory for customization.

#### Scenario: Install builtin flow to workspace

- **WHEN** user runs `@flow /install code-review`
- **AND** `code-review` is a builtin flow (not in catalog)
- **THEN** system copies `examples/code-review.flow.yaml` to `.github/flows/code-review.flow.yaml`
- **AND** system confirms installation with success message

#### Scenario: Builtin flow already installed in workspace

- **WHEN** user runs `@flow /install code-review`
- **AND** `code-review.flow.yaml` already exists in `.github/flows/`
- **THEN** system shows message: "Flow already installed in workspace"
- **AND** system offers option to overwrite with confirmation
