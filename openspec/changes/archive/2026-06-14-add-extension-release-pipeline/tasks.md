## 1. Extension pack and dependencies

- [x] 1.1 Add `extensionPack: ["feima.copilot-more-llms"]` to `package.json`
- [x] 1.2 Add `extensionDependencies: ["github.copilot-chat"]` to `package.json`

## 2. Changelog and scripts

- [x] 2.1 Create `CHANGELOG.md` with Keep a Changelog format and initial `[0.1.0]` section
- [x] 2.2 Add `build:vsix` npm script calling `tsx build/build.ts` to `package.json`
- [x] 2.3 Update `scripts.package` in `package.json` to use `--allow-star-activation --no-dependencies` flags

## 3. Build scripts

- [x] 3.1 Create `build/build.ts` — compiles extension, packages VSIX with `@vscode/vsce`, generates SHA-256 checksum, validates size/structure
- [x] 3.2 Create `build/validate-vsix.sh` — standalone shell script for VSIX size and structure validation

## 4. Release workflow

- [x] 4.1 Create `.github/workflows/release.yml` — tag-triggered pipeline that:
  - Validates version matches `package.json`
  - Compiles extension (`npm ci && npm run compile`)
  - Packages VSIX with `--allow-star-activation --no-dependencies`
  - Generates SHA-256 checksum
  - Validates VSIX structure
  - Creates GitHub Release with VSIX and checksum assets
  - Extracts `CHANGELOG.md` section for release body

## 5. Publish workflow

- [x] 5.1 Create `.github/workflows/publish-marketplace.yml` — `workflow_dispatch` pipeline that:
  - Validates `PUBLISH` confirmation string
  - Checks GitHub Release exists with required VSIX
  - Downloads VSIX and verifies checksum
  - Publishes to Marketplace via `vsce publish --allow-proposed-apis chatSessionsProvider chatParticipantPrivate chatPromptFiles chatParticipantAdditions`
  - Outputs summary with marketplace URL

## 6. Validation

- [x] 6.1 Run `npm run build:vsix` locally and verify VSIX is created in `dist/`
- [x] 6.2 Verify `extensionPack` and `extensionDependencies` fields appear in the packaged VSIX's `package.json`
- [ ] 6.3 Push a test tag to verify `release.yml` triggers and completes (dry run or on a test branch)
