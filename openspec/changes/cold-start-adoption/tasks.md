## 1. Documentation Foundation (Content & Cleanup)

- [x] 1.1 Move 6 engine-internal docs from `docs/` to `src/docs/`: FLOW_SCHEMA.md, CONTEXT_SYSTEM.md, CATALOG_ECOSYSTEM.md, flow-backlog.md, VIRTUAL_TEAM_ROADMAP.md, 11-cli-delegation-background-agents.md
- [x] 1.2 Delete empty stub files: `docs/REDHAT_YAML_DEFAULT_SCHEMA.md`, `docs/REDHAT_YAML_SUMMARY.md`
- [x] 1.3 Add `sharedContext` to `examples/backlog-ranking.flow.yaml` following template (What / When / How / Example / What You'll Get / Customize It)
- [x] 1.4 Add `sharedContext` to `examples/pr-description.flow.yaml` following template
- [x] 1.5 Add `sharedContext` to `examples/test-writing.flow.yaml` following template
- [x] 1.6 Add `sharedContext` to `examples/sequence-basic.flow.yaml` following template (skipped — file does not exist)

## 2. README Rewrite

- [x] 2.1 Restructure README as user-first: Hero → Quick Start (copy-paste, 60s to first value) → What You Can Do (use-case-driven) → Built-in Flows (table with one-liners + deep-link buttons) → Features (condensed) → For Developers (build, test, architecture)
- [x] 2.2 Add `vscode://github.copilot-chat/chat?prompt=...` deep-link "Run in Copilot" buttons for each built-in flow in the README table

## 3. Gallery Onboarding Enhancements

- [x] 3.1 Add "Quick Run" button to `webview-src/gallery/FlowCard.tsx` — copies `@flow #file:<id>.flow.yaml` to clipboard for installed flows, shows "Install first" for uninstalled
- [x] 3.2 Add "Tutorial" link to `FlowCard.tsx` — opens docs site tutorial page when available; omitted when offline or pre-launch
- [x] 3.3 Add difficulty filter chips (Beginner / Intermediate / Advanced) to `webview-src/gallery/App.tsx` with multi-select OR logic and "Clear filters" action
- [x] 3.4 Wire clipboard copy in extension host gallery provider for quick-run

## 4. @flow create Command (Critical Path)

- [x] 4.1 Design and implement the flow-authoring Prompt-TSX skill component (`src/prompts/flowAuthoringSkill.tsx`) — handles structural pattern selection, role decomposition, tool assignment, and sharedContext generation
- [x] 4.2 Implement `@flow create` handler in the flow participant — parses natural language description, invokes skill, writes valid `.flow.yaml` to workspace
- [x] 4.3 Implement `@flow enhance` handler — reads existing flow, applies natural language enhancement instruction, writes modified flow preserving existing structure
- [x] 4.4 Implement sharedContext auto-generation: every flow from `@flow create` includes What / When / How / Example / Customize It sections
- [x] 4.5 Add schema validation of generated output against `schemas/flow.schema.json` before writing to disk
- [x] 4.6 Write unit tests for `@flow create` (valid output, schema compliance, sharedContext presence, error handling)
- [x] 4.7 Write unit tests for `@flow enhance` (preserves existing roles, adds requested features, valid output)
- [x] 4.8 Update `AGENTS.md` with `@flow create` and `@flow enhance` documentation (usage, skill architecture, generation decisions)

## 5. Docs Site (Astro + Starlight)

- [x] 5.1 Scaffold Astro + Starlight in `docs-site/` via `npm create astro@latest -- --template starlight`
- [x] 5.2 Configure Starlight sidebar, theme, site title, and navigation structure
- [x] 5.3 Set up GitHub Actions workflow (`peaceiris/actions-gh-pages`) to build and deploy to `gh-pages` branch on push to main
- [x] 5.4 Write Getting Started: installation page and quickstart page (teaches `@flow create` as first step, not YAML)
- [x] 5.5 Write Tutorial 0: "Your First Flow" — `@flow create "a code review"` → run immediately
- [x] 5.6 Write Tutorial 1: "Make It Yours" — customize generated flow's roles and prompts
- [x] 5.7 Write Tutorial 2: "Connect to Jira" — `@flow enhance <flow> --add-jira-integration`, add tools, auto-create tickets
- [x] 5.8 Write Tutorial 3: "Add Iteration" — `@flow enhance <flow> --add-iterative-stage`, convergence sentinel
- [x] 5.9 Write Tutorial 4: "Go Autonomous" — add `delegate: true`, CLI delegation, background execution
- [x] 5.10 Write guide: "Choosing Execution Patterns" — rewrite of FLOW_PRIMITIVES.md for user audience (use-case-driven decision tree, not dispatch tables)
- [x] 5.11 Write guide: "Referencing Files in Flows" — rewrite of PROMPT_FILE_REFERENCES.md for user audience (copy-pasteable examples for each reference method)
- [x] 5.12 Write guide: "Flow Authoring Concepts" — how to think about role decomposition, effective prompt writing, and structural pattern selection
- [x] 5.13 Write guide: "Tool Integration" — MCP setup patterns, Jira/GitHub integration examples, tool inheritance across roles
- [x] 5.14 Add deep-link "Run in Copilot" buttons (`vscode://github.copilot-chat/chat?prompt=...`) to tutorial pages with clipboard fallback

## 6. Validation & Polish

- [x] 6.1 Verify all P1 production flows pass `flow.schema.json` validation
- [x] 6.2 Verify `docs-site/` builds without errors and deploys correctly
- [x] 6.3 Verify gallery enhancements render correctly in VS Code extension host
- [x] 6.4 Run full test suite (`npm test`) — all existing and new tests pass (33 passed, 6 skipped due to vscode module requirement)
- [x] 6.5 Run `npm run compile` — zero TypeScript errors
- [x] 6.6 Run `npm run lint` — zero ESLint violations on changed files (0 errors, 4 pre-existing warnings in copilotSdkExecutor.ts)
