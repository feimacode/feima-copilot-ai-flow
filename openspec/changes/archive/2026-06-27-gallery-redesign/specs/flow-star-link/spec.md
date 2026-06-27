## ADDED Requirements

### Requirement: Star button displays aggregate star count
Each flow card SHALL display a star button (★) with the aggregate star count from the catalog index. The count SHALL reflect the number of stars on the flow's gist or GitHub repository as pulled by the catalog GitHub action.

#### Scenario: User sees star count on card
- **WHEN** a user views a flow card with 42 stars on GitHub
- **THEN** the star button SHALL display "★ 42"

#### Scenario: Star count shows zero when no stars
- **WHEN** a flow has no stars on GitHub
- **THEN** the star button SHALL display "★ 0"

### Requirement: Star button opens source URL in browser
Clicking the star button SHALL open the flow's source URL (gist.github.com or github.com) in the default browser. The user SHALL be able to star the flow using their existing GitHub browser session.

#### Scenario: User clicks star button
- **WHEN** a user clicks the star button on a flow card
- **THEN** the flow's gist or GitHub URL SHALL open in the default browser

#### Scenario: Star button is disabled when no source URL
- **WHEN** a flow has no sourceUrl (builtin flow)
- **THEN** the star button SHALL be disabled and show tooltip "No source URL available"

### Requirement: Star button tooltip indicates action
The star button SHALL display a tooltip indicating the action: "Star on GitHub (N stars)" where N is the aggregate count.

#### Scenario: User hovers star button
- **WHEN** a user hovers over the star button
- **THEN** a tooltip SHALL display "Star on GitHub (42 stars)" for a flow with 42 stars

### Requirement: Star count is fetched from catalog
The star count SHALL be included in the `IFlowEntryMessage` data sent from the extension host to the webview. The count SHALL be sourced from the catalog index.json which is updated by the catalog GitHub action.

#### Scenario: Gallery loads star counts
- **WHEN** the gallery webview receives flow data from the extension
- **THEN** each flow entry SHALL include starCount field from catalog index

### Requirement: Source URL is included in flow entry
The `IFlowEntryMessage` SHALL include a `sourceUrl` field containing the gist.github.com or github.com URL for the flow source. Builtin flows SHALL have sourceUrl set to null or undefined.

#### Scenario: Catalog flow has source URL
- **WHEN** a flow is sourced from the catalog
- **THEN** the flow entry SHALL include sourceUrl pointing to the gist or GitHub repo

#### Scenario: Builtin flow has no source URL
- **WHEN** a flow is sourced from builtin examples
- **THEN** the flow entry SHALL have sourceUrl set to undefined