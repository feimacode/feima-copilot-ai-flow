## Why

Copilot AI Flow has a working engine, 19 example flows, and solid internal documentation — but no path for a cold-start user to discover value in under 2 minutes. The README leads with architecture concepts ("Model + Harness"), the `docs/` folder mixes engine internals with user guides, 3 of 6 P1 production flows lack self-documenting `sharedContext`, and there is no tutorial pathway. Meanwhile, the engine's biggest adoption barrier — manual YAML authoring — has no mitigation. This change addresses all four gaps in a single sweep: content foundation, engine feature (`@flow create`), docs site, and gallery onboarding.

## What Changes

- **Doc reorg**: Move 6 engine-internal docs from `docs/` to `src/docs/` (architecture, roadmap, strategy). Delete 2 empty stub files. Rewrite 2 remaining user-facing docs for a user audience.
- **README rewrite**: Restructure as user-first (hero → quickstart → use cases → built-in flows table → features → dev section). Add deep-link "Run in Copilot" buttons.
- **`sharedContext` standardization**: Add `sharedContext` to 3 P1 flows missing it (`backlog-ranking`, `pr-description`, `test-writing`) plus `sequence-basic`. Standardize template: What / When / How / Example / Customize.
- **`@flow create` command**: Natural language → valid `.flow.yaml`. Companion `@flow enhance` extends existing flows. Backed by a reusable Prompt-TSX flow-authoring skill. Generated flows auto-include `sharedContext`.
- **Astro + Starlight docs site**: Static site in monorepo (`docs-site/`), deployed to GitHub Pages via Actions. Content: quickstart, 5-tutorial chain (story-estimation anchor), 4 guides. Deep-link "Run in Copilot" buttons (plain `<a>`, no MDX required initially).
- **Gallery onboarding enhancements**: Quick-run buttons (copy `@flow` invocation to clipboard), tutorial links, difficulty filter chips in the existing gallery webview.

## Capabilities

### New Capabilities
- `docs-restructure`: Move engine docs to `src/docs/`, delete stubs, rewrite user-facing docs for user audience, rewrite README as user-first, standardize `sharedContext` across all P1 flows.
- `flow-create-command`: Natural language flow authoring via `@flow create` and `@flow enhance`, backed by a reusable Prompt-TSX skill. Generated flows are schema-validated and include self-documenting `sharedContext`.
- `docs-site`: Astro + Starlight static site in monorepo, deployed to GitHub Pages. Content includes quickstart, 5-tutorial chain, 4 guides, and deep-link buttons.
- `gallery-onboarding`: Quick-run buttons, tutorial links, and difficulty filters in the existing gallery webview.

### Modified Capabilities
- `flow-primitives-docs`: `FLOW_PRIMITIVES.md` rewritten for user audience (was internal-facing). `PROMPT_FILE_REFERENCES.md` rewritten as user guide.

## Impact

- **Affected files**: `README.md`, all files in `docs/` (moved or rewritten), `examples/backlog-ranking.flow.yaml`, `examples/pr-description.flow.yaml`, `examples/test-writing.flow.yaml`, `examples/sequence-basic.flow.yaml`, new `src/docs/` directory, new `docs-site/` directory, `webview-src/gallery/App.tsx`, `webview-src/gallery/FlowCard.tsx`, extension host gallery provider
- **New dependencies**: `astro`, `@astrojs/starlight` (dev only, in `docs-site/`)
- **New engine code**: `@flow create` participant handler, `@flow enhance` handler, flow-authoring Prompt-TSX skill component
- **No breaking changes**: All existing flows, APIs, and commands remain unchanged
