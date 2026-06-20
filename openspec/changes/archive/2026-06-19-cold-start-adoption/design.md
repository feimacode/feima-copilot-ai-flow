## Context

Copilot AI Flow has a working engine and 19 example flows, but no cold-start user pathway. The current `docs/` folder mixes engine-internal architecture docs with user-facing content. The README leads with positioning concepts rather than immediate value. Three of six P1 production flows lack self-documenting `sharedContext`. There is no tutorial pathway, no docs site, and the gallery webview is browse-only with no onboarding hooks. The biggest adoption barrier — manual YAML authoring — has no mitigation.

This change addresses all four gaps: content foundation, engine feature (`@flow create`), docs site, and gallery onboarding. The engine feature is the critical path item — it must land before the docs site so the site can teach `create`-first rather than YAML-first.

## Goals / Non-Goals

**Goals:**
- A cold-start user discovers value in under 2 minutes (copy-paste quickstart → first flow runs)
- Engine docs are separated from user docs: `src/docs/` for internal, `docs/` for user-facing
- All P1 production flows are self-documenting via standardized `sharedContext`
- `@flow create` generates valid, runnable `.flow.yaml` from natural language, with auto-generated `sharedContext`
- `@flow enhance` extends existing flows from natural language instructions
- A static docs site (Astro + Starlight) deployed to GitHub Pages teaches `create`-first
- The gallery webview has quick-run buttons, tutorial links, and difficulty filters

**Non-Goals:**
- MDX or interactive islands in the docs site (plain Markdown + `<a>` deep links suffice)
- A separate docs repository (monorepo: `docs-site/` in `feima-copilot-ai-flow`)
- Enforcing `sharedContext` via schema validation (convention only)
- Rewriting existing engine-internal docs (moved as-is to `src/docs/`)
- Changing the gallery webview architecture (enhancements only, no rewrite)
- Full tutorial content for all 15+ backlog flows (5-tutorial chain + 4 guides only)

## Decisions

### Decision 1: Monorepo docs site (`docs-site/` in `feima-copilot-ai-flow`)

**Rationale:** Keeps content next to code. Single PR for flow + docs changes. No cross-repo sync. The docs site is a build artifact of the same repo — generated from Markdown, deployed to GitHub Pages. If a separate brand domain is needed later, the Astro config changes without moving files.

**Alternatives considered:**
- Separate `feima-copilot-ai-flow-docs` repo: cleaner brand surface but cross-repo sync overhead for every flow change. Rejected for now.

### Decision 2: `@flow create` before docs site

**Rationale:** The docs site should teach `create`-first pedagogy (describe what you want → engine generates → run → customize). If the docs site launches before `create`, it teaches YAML-first and needs a rewrite later. The rewrite cost (~4 hours) is not huge but it's churn. Better to sequence correctly.

**Alternatives considered:**
- Docs site first, rewrite later: acceptable if `create` is far out, but `create` is in this same change. Rejected.

### Decision 3: `src/docs/` for internal docs (not `docs/internal/`)

**Rationale:** Architecture docs, roadmaps, and strategy belong with the engine code they describe. `src/docs/` makes them trivially discoverable for engine contributors (already in `src/`) and makes the split unambiguous: `docs/` is user-facing, `src/docs/` is engine-facing.

**Alternatives considered:**
- `docs/internal/`: keeps all docs in one tree but blurs the boundary. Rejected.

### Decision 4: Plain Markdown for docs site (no MDX initially)

**Rationale:** Deep-link "Run in Copilot" buttons are plain `<a href="vscode://...">` tags — they work in standard Markdown. No interactive islands needed for the initial launch. MDX can be introduced later if live YAML preview or interactive components are needed.

**Alternatives considered:**
- MDX from day one: adds complexity (React islands, hydration) for no immediate benefit. Rejected.

### Decision 5: `sharedContext` as convention, not schema requirement

**Rationale:** Required fields create friction for quick experiments. The `@flow create` command always generates `sharedContext`, and the gallery can surface flows without it with a "needs documentation" indicator. Convention is enforced socially (code review) and mechanically (`@flow create`).

**Alternatives considered:**
- Schema-required `sharedContext`: breaks existing flows, adds friction. Rejected.

### Decision 6: Clipboard copy for gallery quick-run (not direct chat trigger)

**Rationale:** Clipboard is simpler, works cross-platform, and has no coupling to the Copilot Chat extension's internal APIs. Direct trigger requires a command for pre-populating chat input — more powerful but more coupling and fragility.

**Alternatives considered:**
- Direct chat trigger via `vscode.commands.executeCommand`: more seamless UX but requires the Copilot Chat extension to expose a pre-populate command. Can be added later as enhancement.

### Decision 7: Flow-authoring skill as reusable Prompt-TSX component

**Rationale:** The Prompt-TSX component behind `@flow create` should be a standalone, reusable skill. This allows: (a) `@flow enhance` to reuse the same generation logic with an existing flow as context, (b) future features (e.g., `@flow validate --fix`) to reuse it, (c) the skill itself to be documented for power users who want to understand generation decisions.

**Alternatives considered:**
- Inline generation logic in the participant handler: simpler but not reusable. Rejected.

## Risks / Trade-offs

- **`@flow create` generates low-quality flows for complex scenarios**: The Prompt-TSX component may produce suboptimal role decomposition or miss edge cases for highly specialized workflows. → Mitigation: Generated flows are starting points, not final artifacts. `sharedContext` includes "Customize It" hints. `@flow enhance` allows iterative refinement.
- **Docs site content drifts from example flows**: If a flow's `sharedContext` is updated but the docs site tutorial isn't, users see inconsistencies. → Mitigation: Tutorials reference flows by path and describe concepts, not copy-paste `sharedContext` verbatim. The "single source of truth" is the flow file itself.
- **Gallery quick-run copies invocation but user doesn't have the flow installed**: The `@flow #file:` reference requires the flow file to exist locally. → Mitigation: Quick-run button on uninstalled flows shows "Install first" state. Installed flows show the copy button.
- **Astro build adds CI complexity**: A new build step in the repo. → Mitigation: Astro build is fast (~10s for a site this size). GitHub Actions workflow is standard (`peaceiris/actions-gh-pages`). Only runs on push to main.

## Open Questions

- **Exact URI scheme for deep links**: `vscode://github.copilot-chat/chat?prompt=...` vs. a custom `vscode://feima.copilot-ai-flow/run?flow=...` handler. The former works today with zero extension changes. The latter is cleaner but requires extension manifest registration. Decision: start with the Copilot Chat scheme, add custom handler later.
- **Docs site custom domain**: `docs.feima.dev` or similar? Not blocking — GitHub Pages default domain works for launch.
