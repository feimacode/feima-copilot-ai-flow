## Why

`feima-copilot-ai-flow` has no release or marketplace-publish pipeline. Users can only install it from source. We need tag-triggered CI to build and release VSIX packages to GitHub Releases, and a manual publish workflow to push them to the VS Code Marketplace — following the established pattern from `feima-copilot-llms-extension` but simplified for a single-market, English-only extension. We also want `copilot-more-llms` (the Feima global model provider) automatically installed alongside ai-flow via `extensionPack`.

## What Changes

- Add `extensionPack` declaration to `package.json` so `feima.copilot-more-llms` is auto-installed when users install ai-flow
- Add `build/` directory with a build script (`build.ts`) that compiles the extension, packages a VSIX with `@vscode/vsce`, and generates a SHA-256 checksum
- Add `build/validate-vsix.sh` for VSIX structure and size validation
- Add `.github/workflows/release.yml` — tag-triggered CI that compiles, packages, validates, checksums, and creates a GitHub Release with VSIX assets
- Add `.github/workflows/publish-marketplace.yml` — manual workflow that downloads VSIX from a GitHub Release, verifies checksum, and publishes via `vsce publish`
- Add `CHANGELOG.md` for release note extraction
- Add `build:vsix` npm script to `package.json`
- Add `extensionDependencies: ["github.copilot-chat"]` as safety net — ai-flow requires the Copilot Chat extension to function (provides `vscode.lm` API and chat participant surface)

## Capabilities

### New Capabilities

- `extension-release-pipeline`: Tag-triggered GitHub Actions workflows that compile, package, checksum, and publish the `feima.copilot-ai-flow` VSIX to GitHub Releases and the VS Code Marketplace for the global market
- `extension-pack-config`: Auto-install of `feima.copilot-more-llms` via `extensionPack` in `package.json`, providing users a complete model-provider + orchestration experience from a single install

### Modified Capabilities

<!-- No existing spec-level behavior changes. Release/publish is a new concern for this extension. -->

## Impact

- **`package.json`**: New `extensionPack`, `extensionDependencies`, and `build:vsix` script; updated `scripts.package` flags
- **New files**: `build/build.ts`, `build/validate-vsix.sh`, `.github/workflows/release.yml`, `.github/workflows/publish-marketplace.yml`, `CHANGELOG.md`
- **Secrets required**: `VSCE_PAT` (marketplace publisher token), `GITHUB_TOKEN` (standard)
- **No l10n impact**: English-only, single global market — no `l10n/` directory, no `package.nls.json` files needed
- **Existing docs-deploy workflow** (`.github/workflows/docs-deploy.yml`) is unchanged
