## Why

The `orchestration: cli` field was introduced as early exploration of background agent execution, leaking an implementation detail into the user-facing schema. The product mission has since clarified: the key concept is **parallel competing workstreams that converge at a synthesis step** — a fork-join pattern. Renaming `cli` to `parallel` and introducing `groups` + `join` properly expresses this, and enables high-value use cases like UI prototype bake-offs where multiple teams research and implement using different tech stacks to compete for the best outcome.

## What Changes

- **BREAKING** Rename `orchestration: cli` → `orchestration: parallel` across schema, types, engine, and all example files
- **BREAKING** Remove `cliMode` (`supervised` | `autonomous`) — no longer needed
- Move `isolation` from flow-level to group-level (each group declares its own isolation)
- Add `groups` array to `parallel` orchestration — each group has its own `name`, `isolation`, `model`, and `roles`
- Add `join` role to `parallel` orchestration — synthesizes or evaluates group outputs after all groups complete
- Group failures are non-fatal: execution continues with remaining groups; failed groups appear as failure notices in the join role's context
- Join role receives each group's output as a labeled context file (`[Group: <name>]`), enabling structured evaluation

## Capabilities

### New Capabilities

- `parallel-orchestration`: The `orchestration: parallel` mode — replaces `cli`, defines the fork-join execution model with `groups` and `join`

### Modified Capabilities

- `flow-schema`: The flow document schema gains new top-level fields (`groups`, `join`) and loses `cliMode`; `isolation` moves from flow-level to group-level

## Impact

- `src/types/flowDocument.ts` — `OrchestrationStrategy`, `CliMode`, `IFlowDocument` interfaces
- `src/flow/flowService.ts` — parsing, validation, type exports
- `src/flow/flowEngine.ts` — `executeCli()` dispatch and execution path
- `schemas/flow.schema.json` — enum values, new `groups`/`join` property definitions
- `examples/cli-*.flow.yaml` — two example files using `orchestration: cli`
- `docs/FLOW_SCHEMA.md` — orchestration enum documentation
