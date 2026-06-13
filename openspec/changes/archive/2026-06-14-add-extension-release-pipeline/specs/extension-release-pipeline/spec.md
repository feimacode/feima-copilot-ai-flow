## ADDED Requirements

### Requirement: Tag-triggered release build

The system SHALL automatically build a VSIX package when a semantic version tag (`vX.Y.Z`) is pushed to the repository. The workflow SHALL compile the extension, package it with `@vscode/vsce`, generate a SHA-256 checksum, validate the VSIX, and create a GitHub Release with the VSIX and checksum attached as assets.

#### Scenario: Release triggered by version tag

- **WHEN** a tag matching `v[0-9]+.[0-9]+.[0-9]+` is pushed to the repository
- **THEN** the release workflow validates the tag version matches `package.json` version
- **AND** compiles the extension with `npm run compile`
- **AND** packages a VSIX named `feima-copilot-ai-flow-{version}.vsix`
- **AND** generates a `feima-copilot-ai-flow-{version}.vsix.sha256` checksum file
- **AND** validates the VSIX structure contains `extension.vsixmanifest` and `package.json`
- **AND** validates the VSIX is under 5 MB in size
- **AND** creates a GitHub Release with the tag name, attaching the VSIX and checksum as assets

#### Scenario: Manual release dispatch

- **WHEN** the release workflow is triggered via `workflow_dispatch` with a version input
- **THEN** the workflow validates the input version matches `package.json` version
- **AND** proceeds with the same build, package, checksum, and release steps

#### Scenario: Version mismatch rejection

- **WHEN** the tag version or manual input version does not match `package.json` version
- **THEN** the workflow SHALL fail with an error message indicating the mismatch
- **AND** no artifacts SHALL be created

### Requirement: Marketplace publish workflow

The system SHALL provide a manual `workflow_dispatch` pipeline that publishes the VSIX from a GitHub Release to the VS Code Marketplace. The workflow SHALL require a `PUBLISH` confirmation string and SHALL verify the release exists before proceeding.

#### Scenario: Successful marketplace publication

- **WHEN** the publish workflow is triggered with a valid version number and confirmation string `PUBLISH`
- **AND** the corresponding GitHub Release with the VSIX and checksum exists
- **THEN** the workflow downloads the VSIX from the release
- **AND** verifies the SHA-256 checksum matches
- **AND** publishes to the VS Code Marketplace with `vsce publish` using `VSCE_PAT`
- **AND** outputs a summary with the marketplace URL

#### Scenario: Missing confirmation rejection

- **WHEN** the publish workflow is triggered with a confirmation string other than `PUBLISH`
- **THEN** the workflow SHALL fail with an error message
- **AND** no publication SHALL occur

#### Scenario: Missing release rejection

- **WHEN** the publish workflow is triggered but the corresponding GitHub Release does not exist
- **THEN** the workflow SHALL fail with instructions to run the release workflow first

#### Scenario: Checksum mismatch rejection

- **WHEN** the downloaded VSIX SHA-256 hash does not match the checksum file from the release
- **THEN** the workflow SHALL fail with a checksum mismatch error
- **AND** no publication SHALL occur

### Requirement: Local VSIX build script

The system SHALL provide a `build/build.ts` script callable via `npm run build:vsix` that compiles the extension, packages a VSIX, and generates a SHA-256 checksum — producing the same output as the CI release workflow for local verification.

#### Scenario: Local build produces valid VSIX

- **WHEN** a developer runs `npm run build:vsix` in the project root
- **THEN** the script compiles the extension with `tsc` and `esbuild.webview.mjs`
- **AND** packages a VSIX into `dist/feima-copilot-ai-flow-{version}.vsix`
- **AND** generates a checksum at `dist/feima-copilot-ai-flow-{version}.vsix.sha256`
- **AND** validates the VSIX size is under 5 MB
- **AND** validates the VSIX structure contains required files

#### Scenario: Build failure on compilation error

- **WHEN** the TypeScript compilation or esbuild bundling fails
- **THEN** the build script SHALL exit with a non-zero exit code
- **AND** no VSIX SHALL be created

### Requirement: VSIX validation

The system SHALL validate every VSIX before release to ensure it meets size limits and structural requirements.

#### Scenario: Size validation

- **WHEN** a VSIX is built
- **THEN** the validation SHALL check the file size is under 5 MB
- **AND** SHALL warn (but not fail) if the size exceeds the limit

#### Scenario: Structure validation

- **WHEN** a VSIX is built
- **THEN** the validation SHALL verify the VSIX contains `extension/package.json`
- **AND** SHALL verify the VSIX contains `extension.vsixmanifest`
- **AND** SHALL fail if required files are missing

### Requirement: SHA-256 checksum generation

The system SHALL generate a SHA-256 checksum for every built VSIX to enable integrity verification before marketplace publication.

#### Scenario: Checksum generation

- **WHEN** a VSIX is built
- **THEN** a `.sha256` file SHALL be created alongside it
- **AND** the checksum file SHALL contain the SHA-256 hash followed by the VSIX filename

### Requirement: CHANGELOG extraction for release notes

The system SHALL extract the relevant section from `CHANGELOG.md` for the release version to populate the GitHub Release body.

#### Scenario: Changelog section found

- **WHEN** `CHANGELOG.md` exists and contains a `## [X.Y.Z]` section matching the release version
- **THEN** that section SHALL be used as the release body

#### Scenario: Changelog missing

- **WHEN** `CHANGELOG.md` does not exist or does not contain the version section
- **THEN** a default placeholder message SHALL be used as the release body
