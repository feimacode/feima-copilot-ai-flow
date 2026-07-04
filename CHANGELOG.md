# Changelog

All notable changes to the "AI Flow" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Auto flow matching** — AI Flow now scores your chat input against available flows and suggests (or auto-executes) the best match. No need to manually specify a flow file — just describe what you want.
- **Flow matching skill** (`FlowMatchingSkill`) — a Prompt-TSX component that teaches the LM to evaluate user intent against the flow library and return structured match results.
- **Configurable confidence thresholds** — `aiFlow.flowMatch.confidenceThreshold` (default `0.8`) controls when a match auto-executes; `aiFlow.flowMatch.minScore` (default `0.5`) controls the floor for suggestions.
- **Six new extension settings** for fine-grained control:
  - `aiFlow.maxToolRounds` — cap tool-calling loop iterations per role (1–500, default 100)
  - `aiFlow.maxToolCount` — max tools sent to LLM before smart filtering (1–128, default 128)
  - `aiFlow.toolInvokeTokenBudget` — token budget for tool output content (100–16000, default 4000)
  - `aiFlow.maxGenerationRetries` — retries for invalid YAML in `/create` / `/enhance` (1–10, default 3)
- **Settings guide** — new documentation page covering all configuration options with recommended profiles.
- **Propose-Review-Moderate-Apply tutorial** — comprehensive guide on the iterative harness pattern, incorporating insights from Anthropic's harness design research.

### Changed
- **Model selection optimization** — smarter model routing based on task requirements, reducing unnecessary token usage.
- **Flow schema update** — added `doneWord`, `sharedContext`, and `tools` fields to the JSON schema for richer flow definitions.
- **Flow participant refactoring** — cleaner separation between flow discovery, matching, and execution paths.
- **Documentation site overhaul** — removed heavy `flow-demo.gif` (80 MB), added `llms.txt` and `llms-full.txt` for LLM consumption, added `robots.txt`.

### Fixed
- Flow discovery service now correctly handles edge cases in workspace scanning.
- Reference-to-URI resolution improved for `#file:` attachments in flow contexts.

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
