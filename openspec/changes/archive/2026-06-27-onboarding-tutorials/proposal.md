## Why

New users encounter a steep cliff: the first tutorial jumps straight to `@flow /create` with a 3-role code-review flow. There is no "hello world" that isolates the core concept (roles execute in sequence, each seeing the previous output). At the other end, experienced flow authors have no guidance on design patterns — human gates, critic loops, adversarial roles, tool strategy, skills integration — despite these patterns being used extensively in production flows. This change fills both gaps with a three-tier tutorial structure: basic (concept-first, gradual disclosure), middle (domain thread, kept as-is), and advanced (flow author's toolkit).

## What Changes

- **8 new basic tutorials** covering: hello-world flow, pipeline, iteration, fork-join, context files, dialog simulator, tool control, and human gate — each with a minimal example flow and deep-link "try it" buttons
- **4 new advanced tutorials** covering: quality gates (human gate + critic loop + adversarial role), efficiency patterns (tool strategy + context budget + skills), autonomous design (delegation + isolation + composition), and a full-cycle case study
- **7 new example flows** (`hello-world.flow.yaml`, `01-pipeline-review.flow.yaml`, `02-iterative-refine.flow.yaml`, `03-fork-join-perspectives.flow.yaml`, `04-context-files.flow.yaml`, `05-dialog-simulator.flow.yaml`, `06-human-gate.flow.yaml`) — minimal, single-concept flows shipped as builtin examples
- **4 existing demos archived** (`agent-file-demo.flow.yaml`, `cli-autonomous-worktree.flow.yaml`, `hybrid-prompt-agent-demo.flow.yaml`, `prompt-file-demo.flow.yaml`) — their concepts are now covered by tutorials and guides
- **Docs site sidebar restructured** into three tutorial groups: Basic, In Practice, Advanced
- **Gallery tutorial links** updated to point to new tutorial pages where applicable

## Capabilities

### New Capabilities
- `basic-tutorials`: 8 concept-first tutorials with minimal example flows, deep-link buttons, and practice sections for the first two
- `advanced-tutorials`: 4 flow-author-perspective tutorials covering design patterns extracted from production flows
- `tutorial-example-flows`: 7 new minimal example flows shipped as builtin examples; 4 existing feature-demo flows archived

### Modified Capabilities
- `docs-site`: sidebar restructured into Basic / In Practice / Advanced tutorial groups; new tutorial pages added
- `gallery-onboarding`: tutorial links on flow cards updated to point to new tutorial pages

## Impact

- `examples/`: 7 new files added, 4 existing files removed
- `docs-site/src/content/docs/tutorials/`: 12 new `.md` files (8 basic + 4 advanced)
- `docs-site/astro.config.mjs`: sidebar configuration updated
- `webview-src/gallery/`: tutorial URL references updated (if hardcoded)
- `src/flow/builtinSource.ts`: no changes needed (auto-discovers `examples/`)
- `src/flow/flowLibrary.ts`: no changes needed
- `src/prompts/flowAuthoringSkill.tsx`: no changes needed
