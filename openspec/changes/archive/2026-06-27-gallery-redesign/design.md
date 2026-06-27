## Context

The flow gallery is a VS Code webview panel that displays available flows from builtin, catalog, and workspace sources. Currently implemented as a vertical list with expandable preview cards. User feedback indicates the UI feels "clunky" — tall cards, hidden previews, limited metadata, and sparse action options.

The gallery is evolving into a **product surface** (not just a utility) with multiple entry points: browse, discover, star, explore, install, run. This redesign addresses the density, information, and action limitations while keeping the implementation simple (no new dependencies).

**Current state**:
- `FlowCard.tsx`: Single-column list item with expand/collapse preview
- `FlowPreview.tsx`: ReactFlow canvas (180px when expanded)
- `IFlowEntryMessage`: Basic metadata (id, name, description, category, tags, difficulty)
- `gallery.css`: Plain CSS with VS Code theme variables

**Constraints**:
- No new UI libraries (Tailwind, shadcn/ui) — keep bundle ~50KB
- VS Code native styling — use `var(--vscode-*)` theme variables
- Star feature is a link-out (no auth in extension)
- Existing flow editor webview reused for Level 2 preview

## Goals / Non-Goals

**Goals:**
- Improve visual density with responsive grid layout (2-4 columns)
- Show always-visible compact preview (80px) on each card
- Display more metadata: role count, orchestration pattern, author, version
- Add star button linking to gist/github with aggregate count
- Add "Open in Editor" action to launch existing flow editor
- Add "View YAML" action to open source in VS Code editor
- Provide enlarged preview (300px) with role prompt cards

**Non-Goals:**
- Full Tailwind + shadcn/ui migration (overkill for scope)
- Per-user star state tracking (requires auth)
- Editing flows in the gallery (use dedicated editor)
- Complex filter system beyond difficulty chips
- Modal/lightbox preview (inline expansion is sufficient)

## Decisions

### D1: CSS Grid over Flexbox for layout

**Decision**: Use `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` for responsive tile grid.

**Rationale**:
- Auto-adjusts columns based on panel width (2-4 columns)
- Cards maintain consistent width range (280-320px)
- No JavaScript needed for responsive behavior
- Gap spacing is simpler than flexbox margins

**Alternatives considered**:
- Flexbox with `flex-wrap`: Requires more CSS to control card widths
- Masonry layout (variable heights): Complex, not worth the effort
- Fixed columns: Doesn't adapt to panel resize

### D2: Always-visible preview over hover preview

**Decision**: Show 80px compact preview directly on card, no hover interaction required.

**Rationale**:
- Users can scan structure without clicking
- Hover previews can be jittery and hide on mouse move
- Consistent with "browse and discover" use case
- Lightweight ReactFlow (non-interactive) is fast to render

**Alternatives considered**:
- Hover preview (tooltip): Hidden until hover, jittery UX
- No preview on card: Users must expand to see anything
- Static SVG preview: Lighter weight but less flexible

### D3: Inline expansion over modal for enlarged preview

**Decision**: Click magnifier to expand preview inline (card grows from ~190px to ~500px).

**Rationale**:
- User stays in gallery context (no modal overlay)
- Grid row height adjusts automatically
- No new component needed (reuse FlowPreview with larger height)
- Simpler state management (just toggle `previewLevel`)

**Alternatives considered**:
- Modal/lightbox: Requires new Dialog component, loses context
- Side panel: Complex layout change
- New webview tab: Overkill for quick preview

### D4: Plain CSS over Tailwind + shadcn/ui

**Decision**: Keep plain CSS with VS Code theme variables, no Tailwind or component library.

**Rationale**:
- Bundle stays ~50KB (no new dependencies)
- VS Code theming works directly with `var(--vscode-*)`
- Simple scope (5-6 components) doesn't justify framework
- Team velocity: CSS is familiar, no new patterns to learn

**Alternatives considered**:
- Tailwind v4 + shadcn/ui: 70KB bundle overhead, theme bridge complexity
- CSS modules: Overkill for single webview
- Styled-components: Doesn't work well with VS Code theme variables

### D5: Star button as link-out (no auth)

**Decision**: Star button opens gist/github URL in browser, shows aggregate count from catalog.

**Rationale**:
- No auth integration needed in extension
- Uses user's existing browser GitHub session
- Catalog GitHub action pulls star counts periodically
- Simple implementation: just `vscode.env.openExternal(url)`

**Alternatives considered**:
- Auth flow in extension: Complex, requires GitHub OAuth
- Local star tracking: No sync across machines
- Per-user state via GitHub API: Requires token check

### D6: Reuse existing flow editor for Level 2 preview

**Decision**: "Open in Editor" button launches existing `FlowEditor` webview (no new component).

**Rationale**:
- Editor already has full ReactFlow canvas + YAML editing
- No duplicate implementation
- Consistent UX between gallery and editor
- Editor handles both read-only and edit modes

**Alternatives considered**:
- New dedicated viewer webview: Duplicate code
- Read-only mode in enlarged preview: Limited compared to full editor

## Risks / Trade-offs

### R1: Compact preview performance

**Risk**: Rendering ReactFlow for every card could be slow with many flows.

**Mitigation**:
- Use `nodesDraggable: false`, `zoomOnScroll: false` for compact mode
- Consider lazy loading: fetch preview YAML only for visible cards (IntersectionObserver)
- Limit displayed flows to 50 initially, add pagination if needed

### R2: Grid row height with expanded cards

**Risk**: Expanded card (500px) creates large gap in grid row.

**Mitigation**:
- CSS Grid handles this naturally — row height expands for tallest item
- User can collapse to return to compact state
- Consider `grid-auto-rows: masonry` alternative if gaps are problematic

### R3: Missing metadata for builtin flows

**Risk**: Builtin flows may not have roleCount, orchestration, sourceUrl computed.

**Mitigation**:
- Parse flow YAML in `galleryViewProvider._sendFlows()` to extract metadata
- Compute roleCount: count roles in `roles:` or sum across `stages:`
- Determine orchestration: `stages` → 'staged', `groups` → 'fork-join', else 'sequence'
- sourceUrl: null for builtin (no external source)

### R4: Star count freshness

**Risk**: Star counts from catalog may be stale (updated by GitHub action periodically).

**Mitigation**:
- Accept staleness — counts are approximate
- Show "last updated" timestamp if available
- User can click through to see real count on GitHub

## Decisions

### D7: Edit workspace safety for builtin/catalog flows

**Decision**: When user opens a builtin or catalog flow in the editor, show an info notification with an "Install to workspace" button. Do **not** hide the "Open in editor" action — users can still inspect the flow, but they are informed that changes won't persist.

**Rationale**:
- Users expect to view any flow's source, including builtin and catalog
- Hiding the action entirely would block users from viewing YAML
- Info notification provides the warning without blocking the action
- "Install to workspace" button gives a clear path to persistence

**Behavior by source**:

| Source | filePath? | "Open in Editor" behavior | "View YAML" behavior |
|---|---|---|---|
| builtin | ✅ Yes | Opens extension file, shows info: "Changes will be lost on extension update. Install to workspace to save permanently." | Opens in editor tab with same info |
| catalog | ❌ No | Opens as untitled document, shows info: "Install to workspace to edit and save changes." | Same as "Open in Editor" |
| workspace | ✅ Yes | Opens workspace file directly, no warning | Opens in editor tab, no warning |

**Future enhancement (not in scope)**: Add "Publish to your own repo" action that:
1. Creates a gist or pushes to a user repo
2. Triggers catalog re-indexing
3. Updates the local catalog entry to point to the user's version

## Open Questions

1. **Category filter**: Should we add category dropdown/chips beyond difficulty filters?
   - Categories: 'software-development', 'operations', etc.
   - Recommendation: Add in future iteration if users request it

2. **Card height consistency**: Fixed height with truncation vs masonry layout?
   - Recommendation: Fixed height (~190px compact), truncate description to 1 line

3. **Role prompt card truncation**: How much prompt text to show in enlarged view?
   - Recommendation: Show first 200 characters, "Show more" button for full prompt