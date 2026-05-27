## Context

The flow engine currently supports two orchestration modes: `sequence` (in-process, sequential role execution) and `cli` (background agent via Copilot SDK). The `cli` name was a placeholder from early exploration. It exposes implementation mechanics (`cliMode: supervised | autonomous`, flow-level `isolation`) rather than expressing the user-facing intent.

The primary use case driving this change is the **fork-join pattern**: multiple competing groups of AI agents work independently toward the same goal (e.g., three teams prototype the same UI in different stacks), then a synthesizing join role evaluates the outcomes. This pattern requires per-group isolation, group-level failure tolerance, and structured context injection into the join role.

Current state:
- `OrchestrationStrategy = 'sequence' | 'cli'`
- `CliMode = 'supervised' | 'autonomous'` — flow-level, single agent
- `isolation` — flow-level, single worktree or workspace
- No `groups` or `join` concept

## Goals / Non-Goals

**Goals:**
- Rename `orchestration: cli` → `orchestration: parallel` throughout schema, types, engine, examples, and docs
- Drop `cliMode` entirely (no deprecation — early-stage product)
- Add `groups` array to `parallel` orchestration: each group has `name`, optional `isolation`, optional `model`, and `roles`
- Add `join` role to `parallel` orchestration: receives all group outputs as labeled context files
- Non-fatal group failure: continue remaining groups; surface failure notice in join context
- Move `isolation` from flow-level to group-level

**Non-Goals:**
- Runtime concurrency — groups execute serially in the current single-threaded extension host; `parallel` describes the *independence* of workstreams, not thread-level parallelism
- Nested stages inside groups — groups contain only flat `roles` arrays (v1)
- Cross-group context sharing during execution — groups are fully isolated from each other
- Deprecation compatibility shim for `cli` — hard rename, no alias

## Decisions

### D1: `parallel` as the orchestration name (not `agent` or `fork`)
`parallel` communicates independent, non-sequential workstreams converging at a join point — the product concept. `agent` would emphasize execution mechanism. `fork` is too implementation-specific. **Chosen: `parallel`.**

### D2: Groups at top-level, not inside stages
Option A (top-level `groups` on a `parallel` flow) vs Option B (fork-join as a stage type). Option A is simpler, maps cleanly to the bake-off mental model, and doesn't require mixing sync/async execution semantics inside a stage pipeline. **Chosen: Option A.**

### D3: Join role receives structured labeled context files
Each group's full output is injected as a named context file `[Group: <name>]`. Failed groups get a `⚠ Group failed: <error>` notice in their slot. This lets the join role prompt reference groups by name and reason about partial failures. Raw concatenation (Option 1) loses structure; structured diff injection (Option 3) adds complexity without proportional value. **Chosen: Option 2.**

### D4: Hard rename — no `cli` alias
The product is in early development. A compatibility shim adds schema complexity and tests for a user base that doesn't exist yet at scale. Users with `orchestration: cli` flow files get a clear validation error pointing to the rename. **Chosen: hard rename.**

### D5: `isolation` moves to group-level
A `parallel` flow running multiple groups in different worktrees is the primary use case. Flow-level isolation applies to the whole flow and doesn't make sense when different groups need different isolation strategies. **Chosen: group-level `isolation`.**

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Breaking existing `cli` flow files | Clear validation error message: "orchestration: 'cli' is no longer valid, use 'parallel'" |
| `parallel` implies thread-level concurrency which doesn't exist yet | Document clearly: "parallel" = independent workstreams, not concurrent threads |
| Join role context window overflow with many large groups | Join role uses existing `FlowPromptRenderer` priority system — group context files are lower-priority, dropped when budget is tight |
| Group execution order is non-deterministic from user perspective | Groups run in definition order (index order in the `groups` array); this is deterministic and documented |

## Migration Plan

1. Update `OrchestrationStrategy` type: `'sequence' | 'parallel'`
2. Remove `CliMode` type and all references
3. Update `IFlowDocument`: add `groups?: IFlowGroup[]`, add `join?: IFlowRole`, remove `cliMode`, move `isolation` to `IFlowGroup`
4. Add `IFlowGroup` interface
5. Update `FlowService`: update parser, validator, add `parseGroups()`, remove `parseCliMode()`
6. Update `FlowEngine`: rename `case 'cli'` → `case 'parallel'`, replace `executeCli()` with `executeParallel()` implementing group loop + join
7. Update `schemas/flow.schema.json`
8. Update example files and docs

No database migrations or external service changes required.
