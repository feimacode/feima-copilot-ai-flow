# gallery-tile-view Specification

## Purpose
Display flow cards in a responsive tile grid with compact previews, metadata, badges, and quick action buttons.

## Requirements

### Requirement: Gallery displays flows in responsive tile grid
The gallery webview SHALL display flow cards in a CSS Grid layout with responsive columns. The grid SHALL auto-adjust between 2-4 columns based on panel width, with each card having a minimum width of 280px and maximum width of 360px.

#### Scenario: User opens gallery in narrow panel
- **WHEN** the gallery panel width is less than 600px
- **THEN** the grid SHALL display 2 columns of flow cards

#### Scenario: User opens gallery in wide panel
- **WHEN** the gallery panel width is greater than 900px
- **THEN** the grid SHALL display 4 columns of flow cards

#### Scenario: User resizes gallery panel
- **WHEN** the user resizes the gallery panel width
- **THEN** the grid SHALL automatically adjust the number of columns to fit the available space

### Requirement: Each card displays compact preview
Each flow card SHALL display an 80px height ReactFlow preview canvas showing the flow structure. The preview SHALL be non-interactive (no drag, zoom, or pan) and always visible without requiring user interaction.

#### Scenario: User views flow card in gallery
- **WHEN** a user views any flow card in the gallery grid
- **THEN** an 80px preview canvas SHALL be visible showing the flow's node structure

#### Scenario: Preview renders flow structure
- **WHEN** the preview canvas renders a flow with roles
- **THEN** nodes representing the meta node and role nodes SHALL be displayed with connecting edges

### Requirement: Each card displays metadata row
Each flow card SHALL display a metadata row showing role count, orchestration pattern, version, and author. The orchestration pattern SHALL be displayed with an icon: → for sequence, ⟳ for staged, ⎇ for fork-join.

#### Scenario: User sees role count on card
- **WHEN** a user views a flow card
- **THEN** the card SHALL display the number of roles (e.g., "5 roles")

#### Scenario: User sees orchestration pattern on card
- **WHEN** a user views a staged flow card
- **THEN** the card SHALL display "staged" with the ⟳ icon

#### Scenario: User sees author on card
- **WHEN** a flow has an author field
- **THEN** the card SHALL display "by <author>" in the metadata row

### Requirement: Each card displays difficulty and category badges
Each flow card SHALL display difficulty badge with color coding: green for beginner, yellow for intermediate, red for advanced. Category badge SHALL display with blue background. Tags SHALL display with neutral gray background, limited to 3 visible tags with "+N more" indicator if overflow.

#### Scenario: User sees beginner difficulty badge
- **WHEN** a user views a flow card with difficulty "beginner"
- **THEN** a green badge with text "beginner" SHALL be displayed

#### Scenario: User sees truncated tags
- **WHEN** a flow has more than 3 tags
- **THEN** only 3 tags SHALL be displayed with "+N more" indicator showing the remaining count

### Requirement: Each card displays quick action buttons
Each flow card SHALL display action buttons: Run (primary), Install (secondary), Tutorial (ghost, conditional). The Run button SHALL copy the flow invocation command if installed, or trigger install if not installed.

#### Scenario: User clicks Run on installed flow
- **WHEN** a user clicks the Run button on an installed flow
- **THEN** the command `@flow #file:<flow-id>.flow.yaml` SHALL be copied to clipboard

#### Scenario: User clicks Run on uninstalled flow
- **WHEN** a user clicks the Run button on an uninstalled flow
- **THEN** the install action SHALL be triggered first

#### Scenario: Tutorial button is hidden when no tutorial URL
- **WHEN** a flow has no tutorialUrl field
- **THEN** the Tutorial button SHALL NOT be displayed
