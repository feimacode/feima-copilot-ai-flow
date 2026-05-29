## ADDED Requirements

### Requirement: Open visual editor command exists
The system SHALL provide a command `flow.openVisualEditor` that opens the visual flow editor for the currently active flow file.

#### Scenario: Command opens visual editor for active flow file
- **WHEN** user executes `flow.openVisualEditor` command with a flow file active
- **THEN** system SHALL open the visual flow editor for that file
- **AND** visual editor SHALL display the flow graph

#### Scenario: Command shows error when no flow file active
- **WHEN** user executes `flow.openVisualEditor` command with no flow file active
- **THEN** system SHALL show an error message
- **AND** error message SHALL indicate that a flow file must be open

#### Scenario: Command available in command palette
- **WHEN** user opens Command Palette
- **THEN** "Flow: Open Visual Editor" command SHALL be visible
- **AND** command SHALL have keyboard shortcut shown (Ctrl+Shift+E)

---

### Requirement: Toggle editor command exists
The system SHALL provide a command `flow.toggleEditor` that toggles between text and visual editor for the currently active flow file.

#### Scenario: Toggle switches from text to visual editor
- **WHEN** user executes `flow.toggleEditor` command with text editor active
- **THEN** system SHALL open the visual flow editor
- **AND** text editor SHALL remain open (side-by-side or tab)

#### Scenario: Toggle switches from visual to text editor
- **WHEN** user executes `flow.toggleEditor` command with visual editor active
- **THEN** system SHALL open the text editor
- **AND** visual editor SHALL remain open (side-by-side or tab)

#### Scenario: Toggle shows error when no flow file active
- **WHEN** user executes `flow.toggleEditor` command with no flow file active
- **THEN** system SHALL show an error message
- **AND** error message SHALL indicate that a flow file must be open

#### Scenario: Toggle available in command palette
- **WHEN** user opens Command Palette
- **THEN** "Flow: Toggle Editor" command SHALL be visible
- **AND** command SHALL have keyboard shortcut shown (Ctrl+K E)

---

### Requirement: Open visual editor keyboard shortcut
The system SHALL bind `flow.openVisualEditor` command to Ctrl+Shift+E.

#### Scenario: Keyboard shortcut opens visual editor
- **WHEN** user presses Ctrl+Shift+E with a flow file active
- **THEN** visual flow editor SHALL open
- **AND** command SHALL not be intercepted by other extensions

#### Scenario: Keyboard shortcut works in different keyboard layouts
- **WHEN** user uses a non-US keyboard layout
- **THEN** Ctrl+Shift+E SHALL still trigger the command
- **AND** shortcut SHALL respect VS Code's keyboard layout handling

---

### Requirement: Toggle editor keyboard shortcut
The system SHALL bind `flow.toggleEditor` command to Ctrl+K E (chord).

#### Scenario: Keyboard chord toggles editor
- **WHEN** user presses Ctrl+K followed by E with a flow file active
- **THEN** editor SHALL toggle between text and visual
- **AND** command SHALL not be intercepted by other extensions

#### Scenario: Keyboard chord shows suggestion
- **WHEN** user presses Ctrl+K
- **THEN** VS Code SHALL show "E" as a suggestion for the chord
- **AND** suggestion SHALL indicate "Flow: Toggle Editor"

#### Scenario: Keyboard chord works in different keyboard layouts
- **WHEN** user uses a non-US keyboard layout
- **THEN** Ctrl+K E SHALL still trigger the command
- **AND** shortcut SHALL respect VS Code's keyboard layout handling

---

### Requirement: Commands only available for flow files
The system SHALL only enable `flow.openVisualEditor` and `flow.toggleEditor` commands when a flow file is active.

#### Scenario: Commands disabled when non-flow file active
- **WHEN** user has a non-flow file active
- **THEN** "Flow: Open Visual Editor" command SHALL be disabled in command palette
- **AND** "Flow: Toggle Editor" command SHALL be disabled in command palette

#### Scenario: Commands enabled when flow file active
- **WHEN** user has a `*.flow.yaml` or `*.flow.yml` file active
- **THEN** "Flow: Open Visual Editor" command SHALL be enabled
- **AND** "Flow: Toggle Editor" command SHALL be enabled