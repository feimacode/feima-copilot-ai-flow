## Context

The docs site currently has a linear tutorial chain: 5 tutorials following one domain (story estimation) end-to-end. This leaves two gaps:
- **Left gap**: No "hello world" on-ramp. Users jump straight into a 3-role code-review flow without understanding what a flow fundamentally is.
- **Right gap**: No flow-author-perspective tutorials. Production flows use patterns (human gates, critic loops, adversarial roles, skills) that are never explicitly taught.

The `examples/` directory ships 4 feature-demo flows (`agent-file-demo`, `cli-autonomous-worktree`, `hybrid-prompt-agent-demo`, `prompt-file-demo`) that demonstrate reference syntax rather than pedagogical concepts. These will be replaced by minimal, single-concept example flows.

The change adds 12 tutorials and 7 example flows. No code changes are needed in the extension runtime (`src/flow/`, `src/prompts/`) — only static content and sidebar configuration.

## Goals / Non-Goals

**Goals:**
- Provide a complete tutorial ladder from absolute beginner ("what is a flow?") to advanced flow author ("how do I design a human gate + critic loop + delegation pipeline?")
- Each basic tutorial teaches exactly one concept with a minimal, runnable example flow
- Advanced tutorials teach design judgment — when to apply a pattern, not just how
- Example flows are self-documenting via `sharedContext` and discoverable via the gallery
- All tutorials use deep-link "Run in Copilot" buttons for interactivity without requiring MDX/JS

**Non-Goals:**
- No changes to the `@flow` participant runtime, engine, or library
- No changes to `FlowAuthoringSkill` or `@flow /create` behavior
- No interactive YAML editor or flow sandbox in docs (deferred to future)
- No changes to the Astro build pipeline or GitHub Actions deployment
- No tutorial pages for every production flow — only new tutorials get dedicated pages; production flow tutorial links can route to relevant advanced tutorial pages

## Decisions

### Decision 1: Three-tier tutorial structure (Basic / In Practice / Advanced)

**Choice:** Group tutorials into three levels in the sidebar: Basic (concept-first), In Practice (domain thread, existing), Advanced (flow author's toolkit).

**Rationale:** The existing 5 tutorials form a coherent narrative ("follow story estimation from create to autonomous"). Breaking this thread would harm the existing user experience. Instead, we frame it as "In Practice" — the middle tier. Basic tutorials introduce concepts in isolation. Advanced tutorials teach design patterns.

**Alternatives considered:**
- Merge all tutorials into one flat list → rejected: loses progressive disclosure; beginners and advanced users need different entry points
- Replace the existing tutorial chain entirely → rejected: the estimation domain thread is a good narrative for intermediate users

### Decision 2: Example flows are minimal and single-concept

**Choice:** Each basic tutorial gets one example flow that isolates exactly one concept. No tools by default (except `06-human-gate` which needs `vscode_askQuestions`). No agent files, no delegation, no skills. The first two tutorials have practice sections where users add tools.

**Rationale:** The existing demos (`agent-file-demo`, `hybrid-prompt-agent-demo`) combine multiple features in one file. A user who opens them sees `agent:`, `delegate:`, `prompt:`, path references, and URI references simultaneously — overwhelming. Minimal examples let users focus on one thing at a time.

**Alternatives considered:**
- Keep existing demos and add new ones → rejected: clutters the gallery and confuses discovery; the existing demos are reference-syntax showcases, not pedagogical tools
- Make all example flows realistic (full tools, contexts, skills) → rejected: realistic flows are too complex for the "hello world" moment

### Decision 3: Archive existing feature-demo flows

**Choice:** Remove `agent-file-demo.flow.yaml`, `cli-autonomous-worktree.flow.yaml`, `hybrid-prompt-agent-demo.flow.yaml`, and `prompt-file-demo.flow.yaml` from `examples/`.

**Rationale:** Their concepts are covered by: (a) the `referencing-files` guide (prompt file references, agent file references, path vs. name resolution), (b) Basic Tutorial #8 human gate + Advanced #3 autonomous design (delegation, worktree isolation), (c) the new example flows demonstrate all structural primitives. These demos are not referenced by any tutorial or guide.

**Alternatives considered:**
- Move them to a `examples/archive/` folder → rejected: builtin source scans `examples/` recursively; archived flows would still appear in the gallery
- Keep them as "reference examples" → rejected: the gallery is a discovery surface, not a comprehensive reference; stripped-down examples serve beginners better

### Decision 4: Deep-link buttons only, no MDX interactivity

**Choice:** All tutorials use plain Markdown with `vscode://github.copilot-chat/chat?prompt=...` deep-link buttons and `text to copy` fallbacks. No MDX components, no embedded widgets, no YAML sandbox.

**Rationale:** The `docs-site` spec explicitly requires "No MDX required for initial launch." Deep links already provide meaningful interactivity — they pre-fill Copilot Chat with the exact `@flow` invocation. This is consistent with the existing docs site pattern.

**Alternatives considered:**
- Embedded YAML editor widget → rejected: requires MDX + client JS; out of scope for this change
- "Open in Editor" deep links to the flow file → could be added later as an enhancement

### Decision 5: Advanced tutorials reference production flows, don't create new ones

**Choice:** The 4 advanced tutorials reference existing production flows from the harness catalog (`code-review`, `backlog-ranking`, `test-writing`, `war-room-triage`, `sdd-openspec-full-cycle`, `cli-autonomous-worktree`) rather than requiring new example flows.

**Rationale:** These production flows already exist and demonstrate the patterns. Creating additional minimal examples for advanced patterns would be redundant — the point of advanced tutorials is learning to read and design real-world flows, not running toy examples.

**Alternatives considered:**
- Create new minimal example flows for each advanced pattern → rejected: would duplicate effort and the production flows serve as better references

### Decision 6: Tutorial file naming follows kebab-case slug convention

**Choice:** Tutorial `.md` filenames use kebab-case slugs: `hello-world.md`, `pipeline-basics.md`, `iteration-convergence.md`, `fork-join.md`, `context-files.md`, `dialog-simulator.md`, `tool-control.md`, `human-gate.md`, `quality-gates.md`, `efficiency-patterns.md`, `autonomous-design.md`, `case-study-full-cycle.md`.

**Rationale:** Consistent with existing tutorial filenames (`your-first-flow.md`, `customize-flow.md`, `staged-iteration.md`, `cli-delegation.md`). Starlight uses the filename as the URL slug.

## Risks / Trade-offs

- **Risk:** 12 new tutorials may feel overwhelming in the sidebar → **Mitigation:** Three collapsible groups (Basic / In Practice / Advanced) keep the sidebar scannable; users see only their level by default
- **Risk:** Removing existing demos could break bookmarks or references → **Mitigation:** The existing demos are not linked from any tutorial or guide; they were added as internal development references. The `referencing-files` guide covers all their concepts.
- **Risk:** Example flows without tools may feel incomplete → **Mitigation:** The first two tutorials include practice sections that explicitly guide users to add tools; this is a feature, not a bug — it teaches tool control
- **Trade-off:** Deep links go to `#file:` paths that require the flow to be installed → Users must first install flows from the gallery. This is an acceptable nudge toward the install flow.

## Open Questions

- Should the `04-context-files.flow.yaml` example reference a real file that ships with the extension, or use a placeholder path the user must replace? → Leaning toward placeholder with clear "replace this" comment.
- Should advanced tutorials get their own "Run this" deep links pointing to production flows? → Yes, but the production flows live in the harness catalog, not in the builtin examples. The deep links would reference the installed path (`.github/flows/<name>.flow.yaml`).
