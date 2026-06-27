## ADDED Requirements

### Requirement: Magnifier button toggles enlarged preview
Each flow card SHALL display a magnifier icon button (🔍) in the title row. Clicking the magnifier SHALL toggle between compact (80px) and enlarged (300px) preview states.

#### Scenario: User expands preview
- **WHEN** a user clicks the magnifier button on a compact card
- **THEN** the card SHALL expand to show a 300px interactive preview canvas

#### Scenario: User collapses preview
- **WHEN** a user clicks the magnifier button on an enlarged card
- **THEN** the card SHALL collapse back to 80px compact preview

### Requirement: Enlarged preview is interactive
The enlarged preview canvas (300px) SHALL be interactive with zoom on scroll and pan on drag enabled. Users SHALL be able to explore the flow diagram by zooming and panning.

#### Scenario: User zooms preview
- **WHEN** a user scrolls on the enlarged preview canvas
- **THEN** the canvas SHALL zoom in or out

#### Scenario: User pans preview
- **WHEN** a user drags on the enlarged preview canvas
- **THEN** the canvas SHALL pan to show different areas

### Requirement: Enlarged view displays role prompt cards
The enlarged view SHALL display role prompt cards below the preview canvas, showing the role name, prompt text (truncated to 200 characters), and tools list. The first 2 roles SHALL be visible by default with a "Show all N roles" button to expand.

#### Scenario: User sees role prompts in enlarged view
- **WHEN** a user expands a card to enlarged view
- **THEN** role prompt cards SHALL be displayed showing role name and prompt text

#### Scenario: User expands all role prompts
- **WHEN** a user clicks "Show all 5 roles" button
- **THEN** all role prompt cards SHALL be displayed

### Requirement: Enlarged view displays Open in Editor button
The enlarged view SHALL display an "Open in Editor" button that launches the existing flow editor webview with the flow loaded for full exploration and editing.

#### Scenario: User opens flow in editor
- **WHEN** a user clicks "Open in Editor" button
- **THEN** the flow editor webview SHALL open with the flow loaded

### Requirement: Enlarged view displays View YAML button
The enlarged view SHALL display a "View YAML" button that opens the flow source YAML in a VS Code editor tab for read-only viewing.

#### Scenario: User views YAML source
- **WHEN** a user clicks "View YAML" button
- **THEN** the flow YAML file SHALL open in a VS Code editor tab

### Requirement: More menu provides additional actions
Each flow card SHALL display a "More" menu button (⋯) with a dropdown containing: Copy flow reference, Open tutorial, Open source on GitHub, Install to workspace, Open in editor, Uninstall (conditional).

#### Scenario: User copies flow reference
- **WHEN** a user clicks "Copy flow reference" in the More menu
- **THEN** the command `@flow #file:<flow-id>.flow.yaml` SHALL be copied to clipboard

#### Scenario: User opens source on GitHub
- **WHEN** a user clicks "Open source on GitHub" in the More menu
- **THEN** the flow's gist or GitHub repository URL SHALL open in the default browser

#### Scenario: Uninstall is shown only for installed flows
- **WHEN** a flow is not installed in the workspace
- **THEN** the Uninstall option SHALL NOT be displayed in the More menu