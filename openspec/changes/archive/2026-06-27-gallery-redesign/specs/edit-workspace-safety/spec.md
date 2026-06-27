# Edit Workspace Safety

## Purpose

Prevent data loss when users attempt to edit builtin or catalog flows that don't live in the workspace. Guide users to save flows to `.github/flows/` first, which is the only persistent, user-owned location.

## Scenarios

### S1: User opens a builtin flow in the editor

**Given**: A builtin flow is shown in the gallery
**When**: User clicks "Open in Editor" from the enlarged preview
**Then**: The flow opens in the editor
**And**: An info message appears: "This is a built-in flow. Changes will be lost when the extension updates. Install to workspace to save changes permanently."
**And**: The editor tab title shows "(built-in)" or similar readonly indicator

### S2: User opens a catalog flow in the editor

**Given**: A catalog flow is shown in the gallery
**When**: User clicks "Open in Editor" from the enlarged preview
**Then**: The flow YAML opens as an untitled document in the editor
**And**: An info message appears: "This is a catalog flow. Install to workspace to edit and save changes."
**And**: The document is marked as untitled/readonly until saved

### S3: User views YAML of a catalog flow

**Given**: A catalog flow is shown in the gallery
**When**: User clicks "View YAML" from the enlarged preview
**Then**: The same behavior as S2: YAML opens as untitled document with info message

### S4: User opens a workspace flow in the editor

**Given**: A workspace flow (already in `.github/flows/`) is shown in the gallery
**When**: User clicks "Open in Editor"
**Then**: The file opens directly in the editor with no warning

### S5: "Open in Editor" button visibility

**Given**: A flow card is rendered in the gallery
**When**: The flow source is 'builtin', 'catalog', or 'workspace'
**Then**: The "Open in editor" button is always shown in the more menu and enlarged preview
**And**: Non-workspace flows show a readonly indicator or warning when opened

### S6: User edits a builtin flow and tries to save

**Given**: A builtin flow is open in the editor
**When**: User makes changes and presses Ctrl+S
**Then**: VS Code shows "Access Denied" or prompts to "Save As" (standard behavior for extension files)
**And**: The user can choose to save to workspace manually

## Requirements

### R1: Source-based action visibility

The gallery UI must show edit actions for all sources:
- `source === 'workspace'`: Show all edit actions, no warnings
- `source === 'builtin'`: Show "Open in editor", show info message on open
- `source === 'catalog'`: Show "Open in editor", open as untitled document with info message

### R2: Readonly indicator for builtin flows

When opening a builtin flow in the editor:
- Show an info notification: "This is a built-in flow. Changes will be lost when the extension updates. Install this flow to your workspace to save changes permanently."
- Add an "Install to workspace" button in the notification
- Optionally append "(built-in)" to the editor tab title

### R3: Readonly/untitled behavior for catalog flows

When opening a catalog flow in the editor or via "View YAML":
- Open as an untitled document (`{ language: 'yaml', content }`)
- Show an info notification: "This is a catalog flow. Install this flow to your workspace to edit and save changes."
- Add an "Install to workspace" button in the notification
- The untitled document can be edited and saved to any location by the user

### R4: Install-to-workspace quick action

Both warning scenarios provide a one-click "Install to workspace" action that:
1. Calls `FlowLibrary.install(entry, targetFolder)` with `.github/flows/`
2. On success, opens the newly installed file in the editor
3. Refreshes the gallery to show the flow as a workspace source

### R5: Future: Publish to own repo (out of scope)

Documented as future enhancement:
- Add "Publish to GitHub" action in the flow editor
- Creates a gist or pushes to user repo
- Triggers catalog re-indexing
- Updates local catalog entry to point to user's version

## UI Changes

### Gallery webview

- Add `canEdit` field to `IFlowEntryMessage` (derived from `source === 'workspace'`)
- Update `FlowCard` more menu: conditionally show/hide "Open in editor" based on `canEdit`
- Update `EnlargedSection`: replace "Open in Editor" with "Install to workspace" when `!canEdit`

### Extension host

- Update `_handleOpenEditor`: add source check and warning dialog for builtin flows
- Update `_handleViewYaml`: add info notification for catalog flows
- Add `_handleInstallAndOpen`: combined install + open action

## Design Decisions

### D1: Warning dialog vs. banner

**Decision**: Use VS Code's native `showWarningMessage` dialog for builtin flows, and `showInformationMessage` for catalog flows.

**Rationale**:
- Native dialogs are modal and force user attention
- Banners inside webview would require new UI components
- Consistent with VS Code's UX patterns for destructive actions

### D2: Show "Open in editor" for all sources

**Decision**: Keep the "Open in editor" action visible for all sources. For non-workspace flows, show an info notification with an "Install to workspace" button.

**Rationale**:
- Users expect to be able to inspect any flow, including catalog and builtin
- Hiding the action entirely would block users from viewing YAML
- Info notification provides the warning without blocking the action
- "Install to workspace" button gives a clear path to persistence

### D3: Builtin flows open directly with warning

**Decision**: Open builtin flows directly in the editor (not as untitled documents), but show an info notification explaining changes will be lost on update.

**Rationale**:
- Builtin files have a real file path, so opening them directly preserves syntax highlighting and language mode
- VS Code's natural "Access Denied" on save acts as a secondary guard
- Info notification is less disruptive than a modal dialog

### D4: Catalog flows open as untitled documents

**Decision**: Open catalog flows as untitled documents when "Open in Editor" or "View YAML" is clicked.

**Rationale**:
- Catalog flows have no local file path
- Untitled documents clearly signal "not yet saved"
- User can edit and choose where to save
- Info notification guides them to install to workspace

## Related Artifacts

- `gallery-tile-view` spec — card structure and action buttons
- `gallery-preview-depth` spec — enlarged preview section with action buttons
- `gallery-onboarding` spec — flow sources and installation behavior