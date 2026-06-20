# Catalog Integration Design

## Context

The extension currently discovers flows only from:
- **Built-in examples**: `examples/*.flow.yaml` bundled in the VSIX
- **Workspace flows**: `.github/flows/*.flow.yaml` in the current workspace

This limits users to demo flows and manually copied files. The harness ecosystem has a growing catalog of production-ready flows with companion agents, skills, and prompts. The catalog is indexed in `feima-harness-catalog/index.json`, which aggregates entries from multiple providers including `feima-awesome-harness`.

**Current architecture:**
```
FlowLibrary (single source)
  └── scans examples/ + .github/flows/
      └── returns IFlowEntry[] with source: 'builtin'
```

**Constraints:**
- Must work offline (bundled index as fallback)
- Must not break existing workspace flow discovery
- Must keep examples/ as a first-class source so users can discover, run, and play with them
- Must respect the catalog's source-of-truth: `feima-copilot-ai-flow/examples/` flows are canonical, copied to harness repo

## Goals / Non-Goals

**Goals:**
- Fetch and cache `index.json` from the harness catalog
- Allow users to browse, search, and install catalog flows
- Merge builtin, catalog, and workspace flows with workspace taking highest precedence
- Bundle a base `index.json` in the VSIX for offline operation
- Keep examples/ as a first-class builtin source alongside catalog and workspace

**Non-Goals:**
- Managing companion skill/agent installation (beyond reporting)
- Creating or editing catalog entries (catalog repo owns that)
- Hosting a local catalog server (use GitHub raw URLs)
- Multi-catalog support (single catalog index is sufficient)

## Decisions

### Decision 1: CatalogClient with three-tier fallback

**Choice:** Implement `CatalogClient` with fallback chain: cached → fresh fetch → bundled.

**Rationale:**
- **Cached first**: Fastest path, respects TTL, avoids unnecessary network calls
- **Fresh fetch**: Keeps catalog up-to-date when user actively uses it
- **Bundled fallback**: Ensures offline operation and graceful degradation

**Alternatives considered:**
- **Fetch on every activation**: Too slow, wasteful of network, poor offline UX
- **Cache only, no bundled**: Breaks offline operation, no initial catalog data
- **Bundled only, no refresh**: Stale catalog data, defeats purpose of live catalog

**Implementation:**
```typescript
class CatalogClient {
  async getIndex(forceRefresh = false): Promise<ICatalogIndex> {
    // 1. Try cached (if not forced refresh)
    if (!forceRefresh) {
      const cached = await this.tryLoadCached();
      if (cached && this.isCacheFresh(cached)) { return cached; }
    }

    // 2. Try fetch from GitHub
    const fresh = await this.tryFetchRemote();
    if (fresh) {
      await this.cacheIndex(fresh);
      return fresh;
    }

    // 3. Fall back to bundled
    return this.loadBundled();
  }
}
```

### Decision 2: FlowLibrary refactored into three sources

**Choice:** Split `FlowLibrary` into `BuiltinSource`, `CatalogSource`, and `WorkspaceSource`, merge results with precedence.

**Rationale:**
- **Separation of concerns**: Each source has distinct discovery logic
- **Testability**: Can test sources independently
- **Extensibility**: Easy to add new sources later (e.g., local marketplace)
- **Clear precedence**: Workspace > Catalog > Builtin
- **Builtin stays**: Users can discover and run examples/ flows directly — they're a first-class source, not hidden behind a template gallery

**Alternatives considered:**
- **Single FlowLibrary with if/else branches**: Harder to test, less extensible
- **Remove examples/ from FlowLibrary**: Users lose easy access to built-in flows; they'd have to install them manually
- **Catalog only, no workspace**: Breaks existing user workflows

**Implementation:**
```typescript
interface IFlowSource {
  getAll(): Promise<IFlowEntry[]>;
  search(query: string): Promise<IFlowEntry[]>;
  find(nameOrId: string): Promise<IFlowEntry | undefined>;
}

class BuiltinSource implements IFlowSource { /* scans examples/ */ }
class CatalogSource implements IFlowSource { /* parses index.json */ }
class WorkspaceSource implements IFlowSource { /* scans .github/flows/ */ }

class FlowLibrary {
  private sources = [
    this.workspaceSource,
    this.catalogSource,
    this.builtinSource
  ];

  async getAll(): Promise<IFlowEntry[]> {
    const results = await Promise.all(this.sources.map(s => s.getAll()));
    return this.mergeWithPrecedence(results.flat());
  }

  private mergeWithPrecedence(flows: IFlowEntry[]): IFlowEntry[] {
    // Workspace > Catalog > Builtin
    const byId = new Map<string, IFlowEntry>();
    for (const flow of flows) {
      if (flow.source === 'workspace' || !byId.has(flow.id)) {
        byId.set(flow.id, flow);
      }
    }
    return Array.from(byId.values());
  }
}
```

### Decision 3: Source URI resolution strategy

**Choice:** Support both `gist:` and `github:` URI schemes, resolve to raw content URLs.

**Rationale:**
- **Gist**: Per-flow stars/forks, lightweight sharing, existing war-room-triage uses it
- **GitHub**: Single source of truth, no sync problem, repo-level history
- **Both**: Support both patterns, let harness authors choose

**Alternatives considered:**
- **Gist only**: Two sources of truth (repo + gist), sync problem
- **GitHub only**: No per-flow stars/forks, requires all flows in one repo
- **Add Gist-only**: Add complexity for minimal benefit

**Implementation:**
```typescript
function resolveSourceUri(source: string): string {
  if (source.startsWith('gist:')) {
    const gistId = source.slice(5);
    return `https://gist.githubusercontent.com/${gistId}/raw`;
  } else if (source.startsWith('github:')) {
    const path = source.slice(7);
    return `https://raw.githubusercontent.com/${path}`;
  }
  throw new Error(`Unsupported source scheme: ${source}`);
}
```

### Decision 4: Build-time index bundling

**Choice:** Fetch `index.json` during VSIX build in GitHub Actions, include in `assets/`.

**Rationale:**
- **Fresh bundles**: Each VSIX has the latest catalog at build time
- **Offline support**: Bundled index works without network
- **Simple**: No manual commit of index.json, automated by CI

**Alternatives considered:**
- **Commit index.json to repo**: Manual updates, easy to forget
- **Fetch on activation**: No offline support, slow first load
- **No bundling**: Breaks offline operation entirely

**Implementation:**
```yaml
# .github/workflows/build.yml
- name: Fetch catalog index
  run: |
    curl -o assets/index.json \
      https://raw.githubusercontent.com/feimacode/feima-harness-catalog/main/index.json

- name: Validate index.json
  run: |
    node scripts/validate-index.js assets/index.json
```

### Decision 5: Companion reporting only

**Choice:** Report companion skills/agents referenced by flows, but don't auto-install them.

**Rationale:**
- **Ambient resolution**: The extension's existing skill/agent resolution handles companions at runtime
- **No duplication**: Avoid building a parallel installation system for companions
- **User control**: Users manage companions through their preferred mechanism (Claude marketplace, skills.sh, etc.)

**Alternatives considered:**
- **Auto-install companions**: Complex, duplicates existing systems, may conflict
- **Block installation if companions missing**: Too restrictive, users may have custom setups
- **Silent on companions**: Users don't know what's needed, harder to debug

**Implementation:**
```typescript
async install(entry: IFlowEntry, targetFolder: vscode.Uri): Promise<vscode.Uri> {
  const flowContent = await this.fetchFlow(entry.sourceUri);
  await vscode.workspace.fs.writeFile(destUri, Buffer.from(flowContent));

  // Report companions
  if (entry.uses_skills?.length) {
    stream.markdown(`This flow uses skills: ${entry.uses_skills.join(', ')}`);
  }
  if (entry.uses_prompts?.length) {
    stream.markdown(`This flow uses agents: ${entry.uses_prompts.join(', ')}`);
  }
}
```

### Decision 6: Examples/ as first-class BuiltinSource

**Choice:** Keep `examples/` as a `BuiltinSource` in FlowLibrary, discoverable alongside catalog and workspace flows.

**Rationale:**
- **Discoverability**: Users see builtin flows in `/browse` and `/search` — they don't need to know about a separate template gallery
- **Playground**: Users can run builtin flows directly to learn how flows work
- **Canonical source**: `examples/` flows are the authoritative versions; harness repo copies from them
- **Precedence**: Workspace > Catalog > Builtin — if a user installs a catalog flow with the same id, the installed version wins

**Alternatives considered:**
- **Remove examples/ from FlowLibrary**: Users lose easy access; builtin flows hidden behind template gallery
- **Examples/ only in template gallery**: Extra friction to discover and run builtin flows
- **Examples/ as catalog entries**: Confusing — they're not in the catalog index

**Implementation:**
```typescript
class BuiltinSource implements IFlowSource {
  // Extracted from current FlowLibrary._scan() logic
  // Scans context.extensionPath/examples/ for *.flow.yaml
  // Returns IFlowEntry[] with source: 'builtin'
}
```

## Risks / Trade-offs

### Risk 1: Catalog fetch failures cause poor UX

**Risk:** If GitHub fetch fails, users see stale bundled index or error messages.

**Mitigation:**
- Three-tier fallback (cached → fresh → bundled) ensures some catalog always works
- Clear messaging about which catalog source is in use
- `/status` command shows catalog health and age

### Risk 2: Bundled index becomes stale between VSIX releases

**Risk:** Users on older VSIX versions have outdated catalog data.

**Mitigation:**
- Cached catalog refreshes on `/browse` or `/search` (when online)
- Warning message when using stale bundled index
- Recommend updating extension for fresh catalog

### Risk 3: Source URI resolution breaks for new schemes

**Risk:** Future catalog entries may use new URI schemes (e.g., `pkg:` for marketplace).

**Mitigation:**
- Log warning for unsupported schemes
- Graceful degradation (show error, don't crash)
- Extensible `resolveSourceUri()` function, easy to add new schemes

### Risk 4: Workspace flows with same ID as catalog or builtin flows cause confusion

**Risk:** User installs `code-review` from catalog, then creates custom `code-review.flow.yaml`, which one runs?

**Mitigation:**
- Workspace flows always win (source: 'workspace' > 'catalog' > 'builtin')
- Clear labeling in `/browse`: `[workspace] code-review` vs `[catalog] code-review` vs `[builtin] code-review`
- `/status` shows which version is active

### Trade-off 1: Network dependency vs. offline support

**Trade-off:** Fresh catalog requires network, but we want offline support.

**Resolution:** Three-tier fallback balances both. Online users get fresh catalog, offline users get bundled version. TTL prevents excessive network calls.

### Trade-off 2: Catalog freshness vs. VSIX size

**Trade-off:** Larger bundled index increases VSIX size, but provides better offline support.

**Resolution:** Index is small (~10-20KB compressed), negligible impact on VSIX size. Value of offline support outweighs size cost.

### Trade-off 3: Companion installation complexity vs. simplicity

**Trade-off:** Auto-installing companions would be more complete, but adds complexity and duplicates existing systems.

**Resolution:** Report companions only. Ambient skill/agent resolution handles the rest. Simpler, less buggy, respects user's existing setup.

## Migration Plan

### Phase 1: Build catalog infrastructure
1. Create `CatalogClient` class with fetch/cache/fallback logic
2. Add build step to fetch `index.json` during VSIX build
3. Bundle `index.json` in `assets/`
4. Add unit tests for CatalogClient

### Phase 2: Refactor FlowLibrary
1. Create `BuiltinSource` class (extracted from current FlowLibrary._scan())
2. Create `CatalogSource` and `WorkspaceSource` classes
3. Refactor `FlowLibrary` to use three sources and merge logic
4. Update `IFlowEntry.source` to `'builtin' | 'catalog' | 'workspace'`
5. Update FlowEditorProvider to use `examples/` for templates
6. Add integration tests for three-source merging

### Phase 3: Implement flow installation
1. Add source URI resolution (gist:, github:)
2. Implement `install()` method in FlowLibrary
3. Add companion reporting logic
4. Update `@flow /install` command handler
5. Add error handling for fetch failures

### Phase 4: Update slash commands
1. Update `/browse` to show catalog flows with metadata
2. Update `/search` to search across catalog and workspace
3. Add `/refresh` command to force catalog refresh
4. Add `/status` command to show catalog health
5. Update command help text

### Rollback strategy
- If catalog integration causes issues, can disable by:
  - Removing `CatalogSource` from FlowLibrary sources array
  - Falling back to workspace-only mode
  - Reverting to pre-integration FlowLibrary implementation

## Open Questions

1. **TTL duration**: Should catalog cache TTL be 24 hours or configurable?
   - **Proposal**: Default to 24 hours, make configurable via setting `flow.catalogCacheTtl`

2. **Refresh trigger**: Should catalog refresh automatically on `/browse` or require explicit `/refresh`?
   - **Proposal**: Auto-refresh on `/browse` if cache is stale (> 24h), explicit `/refresh` for immediate refresh

3. **Companion installation UI**: Should we offer to install companions via quick pick or just report them?
   - **Proposal**: Report with message, offer quick pick if user wants to install (future enhancement)

4. **Catalog versioning**: How to handle catalog schema version changes?
   - **Proposal**: Validate schema version on load, warn if bundled index has unsupported version, require extension update