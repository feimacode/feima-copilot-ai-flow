# Catalog Integration

## Why

The extension currently only discovers flows from the local `examples/` directory and `.github/flows/`. This limits users to built-in demo flows and manually copied files. The harness ecosystem has a growing catalog of production-ready flows with companion agents, skills, and prompts. Integrating with this catalog makes those flows discoverable and installable, enabling users to leverage the full harness ecosystem while keeping the extension's flows as the authoritative source.

## What Changes

- **Add catalog integration**: Extension fetches `index.json` from `feima-harness-catalog` repo to discover available flows, skills, and prompts
- **Implement flow installation**: Users can install catalog flows to their workspace via `@flow /install <flow-id>`
- **Add CatalogClient**: New service to fetch, cache, and refresh the catalog index with fallback to bundled version
- **Refactor FlowLibrary**: Split into `BuiltinSource`, `CatalogSource`, and `WorkspaceSource`, with workspace taking highest precedence
- **Bundle base index.json**: Include a snapshot of the catalog index in the VSIX for offline operation
- **Keep examples as builtin source**: The `examples/` directory remains a first-class source in FlowLibrary so users can discover, run, and play with them

## Capabilities

### New Capabilities

- `flow-catalog`: Fetch and cache the harness catalog index from GitHub, with fallback to bundled version
- `flow-installation`: Download and install catalog flows to workspace `.github/flows/` directory
- `catalog-source`: Read and parse catalog index entries, converting them to `IFlowEntry` objects
- `index-bundling`: Build-time fetch of `index.json` to bundle in VSIX assets

### Modified Capabilities

None. This is additive functionality with no changes to existing spec-level requirements.

## Impact

**Affected Code:**
- `src/flow/flowLibrary.ts` - Refactor to use builtin + catalog + workspace sources
- `src/flow/flowParticipant.ts` - Update to handle catalog-based `/install` and `/browse`
- New `src/flow/catalogClient.ts` - Catalog fetching and caching logic
- New `src/flow/catalogSource.ts` - Catalog index parsing and flow entry creation
- New `src/flow/builtinSource.ts` - Extracted from current FlowLibrary's examples/ scanning
- Build pipeline - Add step to fetch `index.json` during VSIX build

**New Dependencies:**
- None (uses existing `vscode.workspace.fs` and `fetch` APIs)

**External Systems:**
- `feima-harness-catalog` repo - Source of truth for `index.json`
- GitHub raw content URLs - For fetching catalog index and flow YAML files

**User-Facing Changes:**
- `@flow /browse` now shows builtin + catalog + workspace flows
- `@flow /install <flow-id>` downloads and installs catalog flows
- Builtin examples remain discoverable and runnable alongside catalog flows