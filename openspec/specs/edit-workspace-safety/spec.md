# edit-workspace-safety Specification

## Purpose
Prevent data loss when users attempt to edit builtin or catalog flows that don't live in the workspace. Guide users to save flows to `.github/flows/` first, which is the only persistent, user-owned location.

## Requirements

### Requirement: Source-based action visibility
The gallery UI must show edit actions for all sources:
- `source === 'workspace'`: Show all edit actions, no warnings
- `source === 'builtin'`: Show "Open in editor", show info message on open
- `source === 'catalog'`: Show "Open in editor", open as untitled document with info message

#### Scenario: All sources have Open in Editor
- **WHEN** a flow card is rendered in the gallery
- **THEN** the "Open in editor" button is always shown in the more menu and enlarged preview

### Requirement: Readonly indicator for builtin flows
When opening a builtin flow in the editor:
- Show an info notification: "This is a built-in flow. Changes will be lost when the extension updates. Install this flow to your workspace to save changes permanently."
- Add an "Install to workspace" button in the notification

#### Scenario: User opens a builtin flow in the editor
- **WHEN** user clicks "Open in Editor" from the enlarged preview of a builtin flow
- **THEN** the flow opens in the editor with the info message

### Requirement: Readonly/untitled behavior for catalog flows
When opening a catalog flow in the editor or via "View YAML":
- Open as an untitled document (`{ language: 'yaml', content }`)
- Show an info notification: "This is a catalog flow. Install this flow to your workspace to edit and save changes."
- Add an "Install to workspace" button in the notification
- The untitled document can be edited and saved to any location by the user

#### Scenario: User opens a catalog flow in the editor
- **WHEN** user clicks "Open in Editor" from the enlarged preview of a catalog flow
- **THEN** the flow YAML opens as an untitled document with the info message

#### Scenario: User views YAML of a catalog flow
- **WHEN** user clicks "View YAML" from the enlarged preview of a catalog flow
- **THEN** the same behavior as opening in editor: YAML opens as untitled document with info message

### Requirement: Install-to-workspace quick action
Both warning scenarios provide a one-click "Install to workspace" action that:
1. Calls `FlowLibrary.install(entry, targetFolder)` with `.github/flows/`
2. On success, opens the newly installed file in the editor
3. Refreshes the gallery to show the flow as a workspace source

#### Scenario: User installs from warning
- **WHEN** user clicks "Install to workspace" in the warning notification
- **THEN** the flow is installed to `.github/flows/` and opened in the editor

### Requirement: Workspace flows open normally
Workspace flows (already in `.github/flows/`) open directly in the editor with no warnings.

#### Scenario: User opens a workspace flow in the editor
- **WHEN** a workspace flow is shown in the gallery and user clicks "Open in Editor"
- **THEN** the file opens directly in the editor with no warning
