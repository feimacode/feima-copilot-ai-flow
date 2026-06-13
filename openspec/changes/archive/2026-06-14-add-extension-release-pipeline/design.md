## Context

`feima-copilot-ai-flow` currently has no release or publish pipeline. Developers build locally with `npm run compile` (tsc + esbuild webview bundle) and can manually run `vsce package`. The sibling extension `feima-copilot-llms-extension` has a mature multi-region release/publish system built around `build/region-configs.js` and a backup-modify-package-restore pattern to produce two VSIX variants (CN and Global). For ai-flow, we only need a single global-market, English-only variant — no regional packaging, no l10n directory, no `package.nls.json` files.

The extension also lacks `extensionPack` configuration. We want `feima.copilot-more-llms` (the global Feima model provider) auto-installed alongside it so users get the full experience from one click.

## Goals / Non-Goals

**Goals:**
- Tag-triggered CI that compiles, packages, validates, and creates a GitHub Release with VSIX + checksum
- Manual `workflow_dispatch` pipeline that downloads from a release and publishes to the VS Code Marketplace
- SHA-256 checksum generation for integrity verification
- VSIX validation (size < 5 MB, required files present)
- `extensionPack` to auto-install `feima.copilot-more-llms`
- `extensionDependencies` on `github.copilot-chat` as safety net
- `CHANGELOG.md` for release notes

**Non-Goals:**
- Multi-region packaging (CN + Global). Only global market.
- Runtime localization (`l10n/`). English only.
- Manifest localization (`package.nls.json`). Hardcoded English in `package.json` is sufficient.
- Prerelease support (`-alpha.X`, `-beta.X`). Only stable `X.Y.Z` releases.
- Combined/bundled VSIX with `copilot-more-llms`. `extensionPack` is the marketplace-level bundling mechanism; VSIX files stay separate.

## Decisions

### 1. Single-variant build: no `region-configs.js`, no backup/restore dance

The LLMS extension's `build.ts` backs up `package.json`, mutates it with region-specific values, packages, then restores. For ai-flow, there's nothing to mutate — `package.json` is already the global English variant. The build script can directly call `vsce package` without modifying source files.

**Alternative**: Reuse the LLMS build system as-is with a single `global` region. Rejected — adds unnecessary indirection and complexity. The `build.ts` for ai-flow is ~100 lines vs the LLMS extension's ~500.

### 2. Build script in `build/build.ts` (not inline in CI YAML)

The LLMS extension showed that a TypeScript build script is reusable locally and in CI. We follow that pattern but simplify: no class structure needed — a flat sequence of steps. The script is callable both locally (`npm run build:vsix`) and from CI (`FEIMA_REGION=global tsx build/build.ts`).

### 3. `extensionPack` for model provider bundling

`extensionPack` tells the VS Code Marketplace to also install the listed extensions when the user installs this one. It's non-fatal — ai-flow still activates even if `copilot-more-llms` can't be installed. This matches our goal: users almost always want both, but ai-flow is functional with just Copilot's built-in models.

**Alternative A**: `extensionDependencies`. Hard requirement. Rejected because ai-flow works with `vendor: 'copilot'` alone — making the LLMS extension a hard dependency would block usage if it's unavailable.

**Alternative B**: Bundle LLMS extension files into ai-flow's VSIX. Rejected — adds complexity, duplicates extension registrations, and violates the VS Code extension model.

### 4. `extensionDependencies: ["github.copilot-chat"]` as safety net

While `copilot-more-llms` already declares this dependency (transitively pulling it in), adding it directly to ai-flow ensures the Copilot Chat extension is always present even if someone uninstalls the LLMS extension but keeps ai-flow. The `@flow` participant and all `vscode.lm` calls require the Copilot Chat extension.

### 5. Separate `release.yml` and `publish-marketplace.yml` workflows

Following the LLMS extension pattern. Release builds and creates the GitHub Release. Publish is a manual confirmation step that downloads from the release — providing a gating mechanism before marketplace publication.

### 6. `vscode:prepublish` unchanged — `npm run compile` already does `tsc + esbuild`

The existing `scripts.compile` runs `tsc -p ./ && node esbuild.webview.mjs`, which produces the complete `out/` directory. The `vsce package` call in the build script doesn't need to re-compile — it uses `--no-dependencies` to skip `npm install` (no runtime deps).

### 7. VSIX uses `--allow-star-activation` for packaging, `--allow-proposed-apis` for publishing

The extension uses proposed APIs (`chatSessionsProvider`, `chatParticipantPrivate`, `chatPromptFiles`, `chatParticipantAdditions`). `vsce package` accepts `--allow-star-activation` (proposed APIs are allowed); `vsce publish` requires explicitly listing each one.

## Risks / Trade-offs

- **[Risk] VSCE_PAT secret not configured in ai-flow repo** → The publish workflow will fail. Mitigation: Document in `tasks.md` that the secret must be added before first publish. The release workflow doesn't need it.
- **[Risk] VSIX exceeds 5 MB limit** → The extension bundles webview assets (React, `@xyflow/react`). Mitigation: The build script validates size and warns. If it exceeds, the webview esbuild config can be tuned (tree-shaking, code splitting) — but that's a separate change.
- **[Risk] `extensionPack` resolution fails if `copilot-more-llms` isn't published to the same marketplace** → Both are under publisher `feima` targeting the global marketplace. This should work, but if the LLMS global variant name changes or is unpublished, the pack silently fails (non-fatal).
- **[Trade-off] No prerelease support** → Simpler workflow, but no alpha/beta channel for early testers. Can be added later following the LLMS extension's tag pattern.

## Open Questions

<!-- All decisions made during exploration. No open questions remain. -->
