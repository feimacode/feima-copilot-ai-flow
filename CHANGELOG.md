# Changelog

All notable changes to the "AI Flow" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-06-28

### Fixed
- Reduced extension bundle size for faster installs and startup

## [0.1.3] - 2026-06-25

### Added
- Flow command enhancements: improved `/create` and `/enhance` authoring
- Gallery redesign with better flow previews and category navigation

## [0.1.2] - 2026-06-21

### Fixed
- VSIX package issue affecting extension bundling

## [0.1.1] - 2026-06-17

### Added
- User-facing documentation site with Starlight
- Visual gallery browser with screenshots and flow previews
- Built-in flow catalog integration
- Automated release pipeline with Marketplace publish workflow

### Changed
- Improved onboarding docs and README structure

## [0.1.0] - 2026-06-13

### Added
- Initial release of Feima Copilot AI Flow
- `@flow` chat participant with slash commands (`/search`, `/list`, `/browse`, `/install`, `/create`, `/enhance`)
- Pipeline, staged iteration, and fork-join flow orchestration
- Built-in flow library (Code Review, PR Description, Story Estimation, Backlog Ranking, Test Writing, War-Room Triage)
- Flow visual editor with React Flow canvas
- Skill, tool, agent, and prompt completion providers for `.flow.yaml` files
- Progressive disclosure prompt rendering via `@vscode/prompt-tsx`
- GitHub Copilot SDK delegation for background agent execution
- `.flow.yaml` JSON schema validation
- Extension pack with `feima.copilot-more-llms` for enhanced model selection
