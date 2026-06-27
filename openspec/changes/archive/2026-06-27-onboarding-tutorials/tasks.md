## 1. Example Flows — Create New

- [x] 1.1 Create `examples/hello-world.flow.yaml` — 2-role plan→edit flow, beginner, no tools, standardized sharedContext
- [x] 1.2 Create `examples/01-pipeline-review.flow.yaml` — 3-role analyst→reviewer→summariser pipeline, beginner, standardized sharedContext
- [x] 1.3 Create `examples/02-iterative-refine.flow.yaml` — 1 stage, 2 roles (Writer→Critic), 3 iterations, `<!-- flow:done -->` sentinel, beginner
- [x] 1.4 Create `examples/03-fork-join-perspectives.flow.yaml` — 2 groups (Technical, Business) + join (Synthesiser), beginner
- [x] 1.5 Create `examples/04-context-files.flow.yaml` — single role with `contexts:`, token budget explanation in sharedContext, beginner
- [x] 1.6 Create `examples/05-dialog-simulator.flow.yaml` — 3+ fictional personas (Architect, Dev Lead, PM) in structured discussion, beginner
- [x] 1.7 Create `examples/06-human-gate.flow.yaml` — 2-role pipeline with `vscode_askQuestions` gate before downstream role, beginner

## 2. Example Flows — Archive Existing

- [x] 2.1 Remove `examples/agent-file-demo.flow.yaml`
- [x] 2.2 Remove `examples/cli-autonomous-worktree.flow.yaml`
- [x] 2.3 Remove `examples/hybrid-prompt-agent-demo.flow.yaml`
- [x] 2.4 Remove `examples/prompt-file-demo.flow.yaml`

## 3. Docs Site — Basic Tutorials (8 pages)

- [x] 3.1 Create `docs-site/src/content/docs/tutorials/hello-world.md` — what a flow is, 2 roles, prompt + sharedContext, deep-link to hello-world.flow.yaml
- [x] 3.2 Create `docs-site/src/content/docs/tutorials/pipeline-basics.md` — sequential handoff, 3 roles, practice section: add tools
- [x] 3.3 Create `docs-site/src/content/docs/tutorials/iteration-convergence.md` — stages:, iterations:, `<!-- flow:done -->` sentinel, when to iterate
- [x] 3.4 Create `docs-site/src/content/docs/tutorials/fork-join.md` — groups: + join:, parallel execution, when groups are independent
- [x] 3.5 Create `docs-site/src/content/docs/tutorials/context-files.md` — contexts: file injection, sharedContext, token budget awareness
- [x] 3.6 Create `docs-site/src/content/docs/tutorials/dialog-simulator.md` — fictional role simulation, multi-persona conversation
- [x] 3.7 Create `docs-site/src/content/docs/tutorials/tool-control.md` — explicit tools: lists, context window impact, practice section
- [x] 3.8 Create `docs-site/src/content/docs/tutorials/human-gate.md` — vscode_askQuestions tool, structured questions, single invocation pattern

## 4. Docs Site — Advanced Tutorials (4 pages)

- [x] 4.1 Create `docs-site/src/content/docs/tutorials/quality-gates.md` — human gate + critic loop + adversarial role patterns, naive→improved progression
- [x] 4.2 Create `docs-site/src/content/docs/tutorials/efficiency-patterns.md` — tool strategy + context budget + skills integration
- [x] 4.3 Create `docs-site/src/content/docs/tutorials/autonomous-design.md` — delegation design judgment, worktree isolation, gate+delegate composition
- [x] 4.4 Create `docs-site/src/content/docs/tutorials/case-study-full-cycle.md` — annotated walkthrough of sdd-openspec-full-cycle design decisions

## 5. Docs Site — Sidebar & Configuration

- [x] 5.1 Update `docs-site/astro.config.mjs` sidebar: restructure Tutorials into three collapsible groups (Basic, In Practice, Advanced)
- [x] 5.2 Move existing 5 tutorial entries under "In Practice" group in sidebar config
- [x] 5.3 Add all 12 new tutorial entries to sidebar config under correct groups
- [x] 5.4 Update `docs-site/src/content/docs/index.md` to reference the new tutorial structure

## 6. Gallery — Tutorial URL Updates

- [x] 6.1 Add `tutorialUrl` field to new example flows pointing to corresponding docs pages
- [x] 6.2 Verify gallery webview renders tutorial links for builtin flows with tutorialUrl set

## 7. Validation

- [x] 7.1 Run `npm run compile` from extension root — verify no TypeScript errors
- [x] 7.2 Run `npm run build` from `docs-site/` — verify Astro/Starlight builds without errors
- [x] 7.3 Verify all new example flows parse correctly against `schemas/flow.schema.json`
- [x] 7.4 Verify all deep-link URIs in tutorials use correct URL encoding for `@` and `#` characters
- [x] 7.5 Verify removed example flows no longer appear in gallery (builtin source scan)
