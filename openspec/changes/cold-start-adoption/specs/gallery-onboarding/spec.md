## ADDED Requirements

### Requirement: Quick-run button on gallery flow cards
Each flow card in the gallery webview (`webview-src/gallery/FlowCard.tsx`) SHALL include a "Quick Run" button. For installed flows, the button SHALL copy the `@flow #file:<flow-id>.flow.yaml` invocation to the user's clipboard. For uninstalled flows, the button SHALL display an "Install first" state.

#### Scenario: User copies invocation from installed flow
- **WHEN** a user clicks "Quick Run" on an installed flow card
- **THEN** the `@flow #file:<flow-id>.flow.yaml` command SHALL be copied to their clipboard

#### Scenario: User sees install prompt for uninstalled flow
- **WHEN** a user views a flow card for an uninstalled flow
- **THEN** the "Quick Run" button SHALL show "Install to run" and trigger installation on click

### Requirement: Tutorial link on gallery flow cards
Each flow card in the gallery webview SHALL include a "Tutorial" link when a corresponding tutorial exists. The link SHALL open the relevant docs site page. When no docs site is available (offline or pre-launch), the link SHALL be omitted.

#### Scenario: User navigates to tutorial from gallery
- **WHEN** a user clicks the "Tutorial" link on a flow card
- **THEN** the relevant docs site tutorial page SHALL open in the default browser

### Requirement: Difficulty filter chips in gallery
The gallery webview SHALL include filter chips for difficulty levels: Beginner, Intermediate, Advanced. Selecting a chip SHALL filter the displayed flow cards to matching difficulty. Multiple chips MAY be selected simultaneously (OR logic). A "Clear filters" action SHALL reset to show all flows.

#### Scenario: User filters by difficulty
- **WHEN** a user clicks the "Beginner" filter chip
- **THEN** only flow cards with `difficulty: "beginner"` SHALL be displayed

#### Scenario: User clears filters
- **WHEN** a user clicks "Clear filters"
- **THEN** all flow cards SHALL be displayed regardless of difficulty
