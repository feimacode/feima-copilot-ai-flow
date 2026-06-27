# gallery-onboarding Specification

## Purpose
Enhance the flow gallery webview with quick-run buttons, tutorial links, difficulty filters, tile grid layout, install buttons, and card metadata to improve discoverability and onboarding.

## Requirements

### Requirement: Quick-run button on gallery flow cards
Each flow card in the gallery webview (`webview-src/gallery/FlowCard.tsx`) SHALL include a "Run" button as a primary action. For installed flows, the button SHALL copy the `@flow #file:<flow-id>.flow.yaml` invocation to the user's clipboard. For uninstalled flows, the button SHALL trigger installation first, then copy the invocation.

#### Scenario: User copies invocation from installed flow
- **WHEN** a user clicks "Run" on an installed flow card
- **THEN** the `@flow #file:<flow-id>.flow.yaml` command SHALL be copied to their clipboard

#### Scenario: User runs uninstalled flow
- **WHEN** a user clicks "Run" on an uninstalled flow card
- **THEN** the installation SHALL be triggered, and upon completion the invocation command SHALL be copied

### Requirement: Tutorial link on gallery flow cards
Each flow card in the gallery webview SHALL include a "Tutorial" button as a ghost action when a tutorialUrl exists. The button SHALL open the relevant docs site page in the default browser. When no tutorialUrl is available, the button SHALL be omitted.

#### Scenario: User navigates to tutorial from gallery
- **WHEN** a user clicks the "Tutorial" button on a flow card
- **THEN** the tutorialUrl SHALL open in the default browser

#### Scenario: Tutorial button hidden when no URL
- **WHEN** a flow card has no tutorialUrl field
- **THEN** the Tutorial button SHALL NOT be rendered

### Requirement: Difficulty filter chips in gallery
The gallery webview SHALL include filter chips for difficulty levels: Beginner, Intermediate, Advanced. Selecting a chip SHALL filter the displayed flow cards to matching difficulty. Multiple chips MAY be selected simultaneously (OR logic). A "Clear filters" action SHALL reset to show all flows.

#### Scenario: User filters by difficulty
- **WHEN** a user clicks the "Beginner" filter chip
- **THEN** only flow cards with `difficulty: "beginner"` SHALL be displayed in the grid

#### Scenario: User selects multiple difficulty filters
- **WHEN** a user clicks both "Beginner" and "Intermediate" filter chips
- **THEN** flow cards with either difficulty SHALL be displayed (OR logic)

#### Scenario: User clears filters
- **WHEN** a user clicks "Clear filters"
- **THEN** all flow cards SHALL be displayed regardless of difficulty

### Requirement: Gallery displays responsive tile grid
The gallery webview SHALL display flow cards in a CSS Grid layout that auto-adjusts columns based on panel width. Cards SHALL have minimum width 280px and gap spacing 12px.

#### Scenario: User opens gallery
- **WHEN** the gallery webview loads
- **THEN** flow cards SHALL be displayed in a responsive grid layout

### Requirement: Install button on gallery flow cards
Each flow card SHALL include an "Install" button as a secondary action. Clicking the button SHALL copy the flow to `.github/flows/` directory. The button SHALL display state: idle ("Install"), pending ("…"), done ("✓ Installed"), error ("✕ Error").

#### Scenario: User installs flow
- **WHEN** a user clicks "Install" on a flow card
- **THEN** the flow YAML SHALL be copied to `.github/flows/<flow-id>.flow.yaml`

#### Scenario: Install button shows completion
- **WHEN** installation completes successfully
- **THEN** the button SHALL display "✓ Installed" and be disabled

### Requirement: Tutorial links reference new tutorial pages
Gallery flow cards for builtin example flows SHALL include `tutorialUrl` fields pointing to the corresponding basic tutorial pages on the docs site. The mapping SHALL be: `hello-world` → `/tutorials/hello-world/`, `01-pipeline-review` → `/tutorials/pipeline-basics/`, `02-iterative-refine` → `/tutorials/iteration-convergence/`, `03-fork-join-perspectives` → `/tutorials/fork-join/`, `04-context-files` → `/tutorials/context-files/`, `05-dialog-simulator` → `/tutorials/dialog-simulator/`, `06-human-gate` → `/tutorials/human-gate/`.

#### Scenario: User opens tutorial from gallery for a basic flow
- **WHEN** a user clicks "Tutorial" on a builtin example flow card
- **THEN** the corresponding basic tutorial page SHALL open in the default browser