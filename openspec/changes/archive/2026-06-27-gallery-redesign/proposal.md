## Why

User feedback indicates the flow gallery feels "clunky" — cards are tall and sparse, previews are hidden behind clicks, and users can't see enough information to make quick decisions. As the gallery evolves into a primary entry point for browsing, discovering, starring, and exploring flows, the current list-based layout no longer serves the growing feature set.

## What Changes

- **Grid layout**: Replace vertical list with responsive 2-4 column tile grid using CSS Grid
- **Compact preview**: Always-visible 80px ReactFlow preview on each card (no click required)
- **Enlarged preview**: Click magnifier to expand inline to 300px with role prompt cards
- **Metadata row**: Show role count, orchestration pattern (sequence/staged/fork-join), version, author
- **Star button**: Link to gist/github source with aggregate star count (no auth in extension)
- **More menu**: Dropdown with copy reference, open tutorial, open source, install, edit, uninstall
- **Open in editor**: Button to launch existing flow editor webview from enlarged view
- **View YAML**: Button to open flow source in VS Code editor tab
- **Edit workspace safety**: For builtin/catalog flows, show an info message when opened in the editor explaining changes won't persist, with a quick-action to "Install to workspace". All flows remain openable for inspection.
- **Future: Publish to own repo**: Roadmap item — tools to help users publish flows to their own GitHub repo and get them indexed in the catalog.

## Capabilities

### New Capabilities

- `gallery-tile-view`: Responsive grid layout with compact cards showing preview, metadata, and actions
- `gallery-preview-depth`: Three-level preview system (compact → enlarged → dedicated editor)
- `flow-star-link`: Star button linking to gist/github source with aggregate count display

### Modified Capabilities

- `gallery-onboarding`: Extends existing spec — adds grid layout, preview depth, metadata display, and additional actions beyond quick-run and tutorial

## Impact

**Affected files**:
- `webview-src/gallery/App.tsx` — Grid container, filter bar, preview state management
- `webview-src/gallery/FlowCard.tsx` — Complete redesign with preview, metadata, actions
- `webview-src/gallery/gallery.css` — Grid styles, card styles, all new elements
- `webview-src/shared/types.ts` — Extend `IFlowEntryMessage` with roleCount, orchestration, sourceUrl, starCount
- `webview-src/shared/FlowPreview.tsx` — Add `compact` mode (80px, non-interactive)
- `src/ui/galleryViewProvider.ts` — Compute roleCount, orchestration, sourceUrl, starCount from flow YAML
- `src/flow/flowLibrary.ts` — Ensure catalog entries include sourceUrl and starCount

**Bundle size**: No new dependencies — remains ~50KB (React + @xyflow/react + plain CSS)

**Future roadmap**: Tools to help users publish flows to their own GitHub repo and get them indexed in the catalog (out of scope for this change).

**Breaking changes**: None — existing functionality preserved, UI enhanced