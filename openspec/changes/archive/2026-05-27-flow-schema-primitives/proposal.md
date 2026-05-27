## Why

The current flow schema uses a top-level `orchestration:` field as a mode switch that couples structural pattern (pipeline/iterative/fork-join) with execution path (VS Code LM API vs Copilot SDK), preventing hybrid flows and making the primitives unclear to both authors and AI agents working on the codebase. Additionally, `agent:` on a role currently means "content source" but has been ambiguously used to also imply execution delegation, and no canonical reference exists defining the design primitives for either human or AI consumers.

## What Changes

- **BREAKING** Remove top-level `orchestration:` field; execution pattern is now implicit from which root key is present (`roles:`, `stages:`, or `groups:` + `join:`)
- **BREAKING** Rename `orchestration: parallel` flows to use `groups:` + `join:` at root (no `orchestration:` needed)
- **BREAKING** Rename `orchestration: sequence` + `stages:` flows to use `stages:` at root directly
- Add `delegate: true` as an optional annotation on `IFlowRole` — changes execution path from `callRole` (VS Code LM API) to `callRoleAgent` (Copilot SDK); orthogonal to `agent:` (content source)
- Rename engine methods: `executeSequential` → `executePipeline`, `executeStages` → `executeIterative`, `executeParallel` → `executeForkJoin`, `callRoleSdk` → `callRoleAgent`
- Add `docs/FLOW_PRIMITIVES.md` — human-readable canonical reference for all flow design primitives with diagrams and examples
- Update `AGENTS.md` — add a precise AI-readable primitives reference section covering schema→engine mappings, key distinctions, and validation rules

## Capabilities

### New Capabilities

- `delegate-role-execution`: A role can be annotated with `delegate: true` to route its execution through the Copilot SDK agent runtime rather than the VS Code LM API. Orthogonal to prompt content source (`agent:`). Most valuable in fork-join groups where branches can run autonomously.
- `flow-primitives-docs`: Canonical documentation of the flow design primitives in two formats — `docs/FLOW_PRIMITIVES.md` for humans (mental model, diagrams, YAML examples) and a new section in `AGENTS.md` for AI agents (schema→engine mapping, key distinctions, validation rules).

### Modified Capabilities

- `flow-orchestration`: **BREAKING** — removes `orchestration:` field. The structural pattern is now determined by which root-level key is present. This changes the schema contract for all existing `.flow.yaml` files.

## Impact

- `src/types/flowDocument.ts` — remove `OrchestrationStrategy` type, add `delegate?: boolean` to `IFlowRole`
- `src/flow/flowEngine.ts` — rename 4 methods, update dispatch logic in `execute()` to remove `orchestration` switch
- `src/flow/flowService.ts` — update `validate()` to enforce root key XOR rules, remove `orchestration` field parsing
- `schemas/flow.schema.json` — remove `orchestration` property, add `delegate` boolean to role schema, add validation for root key mutual exclusivity
- `AGENTS.md` — add Flow Execution Primitives reference section
- `docs/FLOW_PRIMITIVES.md` — new file
- All `.flow.yaml` example files — migration needed (remove `orchestration:` field)
