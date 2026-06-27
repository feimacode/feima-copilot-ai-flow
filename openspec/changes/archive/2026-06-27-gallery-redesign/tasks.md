## 1. Data Model Extension

- [x] 1.1 Extend `IFlowEntryMessage` in `webview-src/shared/types.ts` with new fields: `roleCount`, `orchestration`, `sourceUrl`, `starCount`
- [x] 1.2 Update `galleryViewProvider._sendFlows()` to compute roleCount from flow YAML (count roles in `roles:` or sum across `stages:`)
- [x] 1.3 Update `galleryViewProvider._sendFlows()` to determine orchestration pattern: `stages` → 'staged', `groups` → 'fork-join', else 'sequence'
- [x] 1.4 Update `galleryViewProvider._sendFlows()` to include sourceUrl and starCount from catalog entries
- [x] 1.5 Ensure `FlowLibrary.getAll()` returns entries with sourceUrl and starCount for catalog flows

## 2. Grid Layout Implementation

- [x] 2.1 Update `gallery.css` to change `.flow-list` to CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
- [x] 2.2 Add gap spacing (12px) and padding (12px) to `.flow-list` grid container
- [x] 2.3 Remove border-bottom separator from `.flow-card` (cards now separated by grid gap)
- [x] 2.4 Add responsive behavior: ensure grid adjusts columns based on panel width
- [x] 2.5 Update `App.tsx` to remove any list-specific layout code (if needed)

## 3. FlowCard Component Redesign

- [x] 3.1 Refactor `FlowCard.tsx` to new structure: preview → title row → description → badges → metadata → actions
- [x] 3.2 Add preview section component with 80px height ReactFlow canvas (non-interactive)
- [x] 3.3 Add title row with flow name, magnifier button, star button, more menu button
- [x] 3.4 Add description row with single-line truncation and tooltip for full text
- [x] 3.5 Add badges row with difficulty (color-coded), category (blue), tags (gray, max 3)
- [x] 3.6 Add metadata row with role count, orchestration icon, version, author
- [x] 3.7 Add quick actions row: Run (primary), Install (secondary), Tutorial (ghost, conditional)
- [x] 3.8 Update `gallery.css` with all new card element styles (preview-section, title-row, badges-row, metadata-row, actions-row)

## 4. Preview Component Enhancement

- [x] 4.1 Add `compact` prop to `FlowPreview.tsx` component
- [x] 4.2 When `compact=true`: set height to 80px, disable all interactions (drag, zoom, pan, select)
- [x] 4.3 When `compact=true`: reduce node font-size to 9px, padding to 2px 4px, hide background grid
- [x] 4.4 When `compact=false` (enlarged): set height to 300px, enable zoom and pan
- [x] 4.5 Add CSS styles for `.preview-section--compact` and `.preview-section--enlarged`

## 5. Star Button Implementation

- [x] 5.1 Create `StarButton.tsx` component in `webview-src/gallery/`
- [x] 5.2 Display star icon (★) with aggregate count from `flow.starCount`
- [x] 5.3 On click: call `vscode.postMessage({ type: 'openUrl', url: flow.sourceUrl })`
- [x] 5.4 Disable button when `sourceUrl` is undefined, show tooltip "No source URL available"
- [x] 5.5 Add tooltip "Star on GitHub (N stars)" when sourceUrl exists
- [x] 5.6 Add CSS styles for `.star-btn` (icon button with count display)

## 6. More Menu Implementation

- [x] 6.1 Create `MoreMenu.tsx` component in `webview-src/gallery/` as dropdown menu
- [x] 6.2 Add menu items: Copy flow reference, Open tutorial, Open source on GitHub, Install to workspace, Open in editor, Uninstall
- [x] 6.3 Implement "Copy flow reference" action: copy `@flow #file:<id>.flow.yaml` to clipboard
- [x] 6.4 Implement "Open source on GitHub" action: same as star button (open sourceUrl)
- [x] 6.5 Implement "Open in editor" action: post message `{ type: 'openEditor', id }`
- [x] 6.6 Conditionally show "Uninstall" only when flow is installed in workspace
- [x] 6.7 Add CSS styles for dropdown menu (`.more-menu`, `.more-menu-item`)
- [x] 6.8 Update `galleryViewProvider.ts` to handle `openEditor` message type

## 7. Enlarged Preview View

- [x] 7.1 Add `previewLevel` state to `FlowCard.tsx`: 'compact' | 'enlarged'
- [x] 7.2 Implement magnifier button click handler to toggle `previewLevel`
- [x] 7.3 When `previewLevel === 'enlarged'`: render enlarged section below actions row
- [x] 7.4 Create `EnlargedSection.tsx` component with: 300px preview canvas, role prompt cards, action buttons
- [x] 7.5 Create `RolePromptCard.tsx` component showing: role name, prompt text (truncated to 200 chars), tools list
- [x] 7.6 Show first 2 role prompt cards by default, add "Show all N roles" expand button
- [x] 7.7 Add "Open in Editor" button that posts `{ type: 'openEditor', id }` message
- [x] 7.8 Add "View YAML" button that posts `{ type: 'viewYaml', id }` message
- [x] 7.9 Add "Collapse" button to return to compact state
- [x] 7.10 Update `galleryViewProvider.ts` to handle `viewYaml` message type (open YAML in VS Code editor tab)
- [x] 7.11 Add CSS styles for `.enlarged-section`, `.role-prompt-card`, `.role-prompt-header`, `.role-prompt-text`

## 8. Extension-side Message Handlers

- [x] 8.1 Add `openEditor` message handler in `galleryViewProvider.ts`: launch existing flow editor webview with flow loaded
- [x] 8.2 Add `viewYaml` message handler in `galleryViewProvider.ts`: open flow YAML file in VS Code editor tab (read-only)
- [x] 8.3 Ensure `openUrl` handler already exists for star button and "Open source" menu item

## 9. Edit Workspace Safety

- [x] 9.1 Add `canEdit` flag to `IFlowEntryMessage`: `true` for workspace flows, `false` for builtin/catalog
- [x] 9.2 Update `_handleOpenEditor` to show info message for builtin flows: "This is a built-in flow. Changes will be lost when the extension updates. Install to workspace to save permanently."
- [x] 9.3 Update `_handleOpenEditor` to open catalog flows as untitled documents with info message: "This is a catalog flow. Install to workspace to edit and save changes."
- [x] 9.4 Add "Install to workspace" quick-action button in the info messages for builtin and catalog flows
- [x] 9.5 Update `_handleViewYaml` to show the same info message and untitled document behavior for catalog flows
- [x] 9.6 Ensure "Open in Editor" and "View YAML" buttons remain visible for all flow sources
- [x] 9.7 Refresh gallery after installing to workspace from an info message

## 10. Testing & Validation

- [x] 10.1 Run `npm run compile` and fix all TypeScript errors
- [ ] 10.2 Visual verification: open gallery, confirm grid layout displays correctly
- [ ] 10.3 Visual verification: resize panel, confirm grid columns adjust responsively
- [ ] 10.4 Visual verification: confirm compact preview renders on each card
- [ ] 10.5 Functional verification: click magnifier, confirm enlarged preview appears with role cards
- [ ] 10.6 Functional verification: click star button, confirm source URL opens in browser
- [ ] 10.7 Functional verification: click "Open in Editor", confirm flow editor webview opens
- [ ] 10.8 Functional verification: click "View YAML", confirm YAML opens in VS Code editor
- [ ] 10.9 Functional verification: confirm search/filter still works
- [ ] 10.10 Functional verification: confirm install and run actions still work