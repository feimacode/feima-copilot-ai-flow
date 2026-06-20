# Catalog Integration Tasks

## 1. Build Catalog Infrastructure

- [x] 1.1 Create `src/flow/catalogClient.ts` module with `CatalogClient` class
- [x] 1.2 Define `ICatalogIndex`, `ICatalogFlow`, `ICatalogSkill`, `ICatalogPrompt`, `ICatalogProvider` interfaces
- [x] 1.3 Implement `getIndex(forceRefresh?: boolean)` method with three-tier fallback
- [x] 1.4 Implement `tryLoadCached()` method to read from `globalStorageUri/catalog/index.json`
- [x] 1.5 Implement `tryFetchRemote()` method to fetch from GitHub raw URL with timeout
- [x] 1.6 Implement `loadBundled()` method to read from `context.extensionPath/assets/index.json`
- [x] 1.7 Implement `cacheIndex(index)` method to write to global storage
- [x] 1.8 Implement `isCacheFresh(cached)` method with 24-hour TTL check
- [x] 1.9 Add error handling and logging for all fetch/cache operations
- [x] 1.10 Add unit tests for CatalogClient (mock fetch, test fallback chain)
- [x] 1.11 Add `scripts/validate-index.js` script to validate index.json against schema
- [x] 1.12 Update `build/build.ts` to fetch index.json during VSIX build
- [x] 1.13 Add GitHub Actions step to fetch and validate index.json
- [x] 1.14 Create `assets/` directory and add to `.gitignore` (generated at build time)
- [x] 1.15 Copy `examples/*.flow.yaml` to `feima-awesome-harness/flows/` (seed catalog with builtin flows)

## 2. Refactor FlowLibrary

- [x] 2.1 Define `IFlowSource` interface with `getAll()`, `search()`, `find()` methods
- [x] 2.2 Create `src/flow/builtinSource.ts` module with `BuiltinSource` class (extracted from current FlowLibrary)
- [x] 2.3 Implement `BuiltinSource.getAll()` to scan `examples/` directory for `*.flow.yaml`
- [x] 2.4 Implement `BuiltinSource.search(query)` to filter builtin flows
- [x] 2.5 Implement `BuiltinSource.find(nameOrId)` to find builtin flow by id or name
- [x] 2.6 Create `src/flow/catalogSource.ts` module with `CatalogSource` class
- [x] 2.7 Implement `CatalogSource.getAll()` to parse catalog flows into `IFlowEntry[]`
- [x] 2.8 Implement `CatalogSource.search(query)` to filter catalog flows
- [x] 2.9 Implement `CatalogSource.find(nameOrId)` to find catalog flow by id or name
- [x] 2.10 Add catalog entry to `IFlowEntry` conversion logic (handle optional fields)
- [x] 2.11 Create `src/flow/workspaceSource.ts` module with `WorkspaceSource` class
- [x] 2.12 Implement `WorkspaceSource.getAll()` to scan `.github/flows/` directory
- [x] 2.13 Implement `WorkspaceSource.search(query)` to filter workspace flows
- [x] 2.14 Implement `WorkspaceSource.find(nameOrId)` to find workspace flow by id or name
- [x] 2.15 Refactor `FlowLibrary` to use `BuiltinSource`, `CatalogSource`, and `WorkspaceSource`
- [x] 2.16 Implement `mergeWithPrecedence()` method (workspace > catalog > builtin)
- [x] 2.17 Update `IFlowEntry.source` type to be `'builtin' | 'catalog' | 'workspace'`
- [x] 2.18 Add `sourceUri`, `provider`, `trust`, `orchestration`, `roleCount` fields to `IFlowEntry`
- [x] 2.19 Update `FlowLibrary.install()` to handle builtin (copy from examples/) and catalog (fetch from sourceUri) entries
- [x] 2.20 Add integration tests for source merging and precedence logic
- [x] 2.21 Update FlowEditorProvider to scan `examples/` for template gallery

## 3. Implement Flow Installation

- [x] 3.1 Create `src/flow/sourceUriResolver.ts` module
- [x] 3.2 Implement `resolveSourceUri(source: string)` function
- [x] 3.3 Add support for `gist:` scheme (resolve to gist.githubusercontent.com/raw)
- [x] 3.4 Add support for `github:` scheme (resolve to raw.githubusercontent.com)
- [x] 3.5 Add error handling for unsupported URI schemes
- [x] 3.6 Implement `fetchFlow(sourceUri: string)` function with timeout
- [x] 3.7 Add validation for fetched YAML content (check it's valid flow file)
- [x] 3.8 Update `FlowLibrary.install()` to use `fetchFlow()` for catalog entries
- [x] 3.9 Add duplicate detection (check if file already exists in target folder)
- [x] 3.10 Implement overwrite confirmation prompt for existing flows
- [x] 3.11 Add `.github/flows/` directory creation if missing
- [x] 3.12 Implement companion reporting (show `uses_skills` and `uses_prompts`)
- [x] 3.13 Add error handling for network failures during flow fetch
- [x] 3.14 Add error handling for invalid YAML during flow fetch
- [x] 3.15 Add unit tests for source URI resolution
- [x] 3.16 Add unit tests for flow fetch and validation

## 4. Update Slash Commands

- [x] 4.1 Update `/browse` command to show catalog flows with metadata
- [x] 4.2 Add `[official]` and `[community]` trust badges to browse results
- [x] 4.3 Add provider name display in browse results
- [x] 4.4 Add orchestration pattern display in browse results
- [x] 4.5 Add role count display in browse results
- [x] 4.6 Update `/search` command to search across catalog and workspace
- [x] 4.7 Add source labels to search results (`[catalog]`, `[workspace]`)
- [x] 4.8 Implement source filtering (`--source catalog`, `--source workspace`)
- [x] 4.9 Update `/install` command to handle catalog flow installation
- [x] 4.10 Add companion reporting to `/install` output
- [x] 4.11 Add `/refresh` command to force catalog refresh from GitHub
- [x] 4.12 Add `/status` command to show catalog health and metadata
- [x] 4.13 Update command help text to reflect catalog integration
- [x] 4.14 Add warning messages when using stale bundled index
- [x] 4.15 Add success/error messages for all catalog operations

## 5. Testing and Validation

- [ ] 5.1 Test catalog fetch with valid index.json
- [ ] 5.2 Test catalog fallback when GitHub fetch fails
- [ ] 5.3 Test bundled index loading when offline
- [ ] 5.4 Test cache TTL and refresh behavior
- [ ] 5.5 Test flow installation from gist source
- [ ] 5.6 Test flow installation from GitHub source
- [ ] 5.7 Test duplicate flow installation prevention
- [ ] 5.8 Test workspace flow override of catalog flow
- [ ] 5.9 Test workspace flow override of builtin flow
- [ ] 5.10 Test catalog flow override of builtin flow
- [ ] 5.11 Test `/browse` shows builtin, catalog, and workspace flows
- [ ] 5.12 Test `/search` across builtin, catalog, and workspace
- [ ] 5.13 Test `/refresh` forces catalog update
- [ ] 5.14 Test `/status` shows correct catalog information
- [ ] 5.15 Test builtin flows are discoverable and runnable
- [ ] 5.16 Test builtin flow installation (copy to workspace)
- [ ] 5.17 Test offline operation with bundled index
- [ ] 5.18 Test error handling for invalid catalog index
- [ ] 5.19 Test error handling for invalid flow YAML
- [ ] 5.20 Test companion reporting for flows with skills/prompts
- [ ] 5.21 Add end-to-end test for full catalog workflow

## 6. Documentation

- [ ] 6.1 Update README.md with catalog integration overview
- [ ] 6.2 Add documentation for `/browse`, `/search`, `/install`, `/refresh`, `/status` commands
- [ ] 6.3 Add troubleshooting section for catalog issues
- [ ] 6.4 Document catalog source URI formats (gist:, github:)
- [ ] 6.5 Document companion resolution behavior
- [ ] 6.6 Update AGENTS.md with catalog integration details
- [ ] 6.7 Add examples of catalog flow installation
- [ ] 6.8 Document offline operation behavior
- [ ] 6.9 Document build-time index bundling process
- [ ] 6.10 Update CHANGELOG.md with catalog integration features