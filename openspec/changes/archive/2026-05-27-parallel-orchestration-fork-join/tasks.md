## 1. Types and Interfaces

- [x] 1.1 Rename `OrchestrationStrategy` from `'sequence' | 'cli'` to `'sequence' | 'parallel'` in `src/types/flowDocument.ts`
- [x] 1.2 Remove `CliMode` type from `src/types/flowDocument.ts`
- [x] 1.3 Add `IFlowGroup` interface to `src/types/flowDocument.ts` (`name`, `roles`, `isolation?`, `model?`, `skills?`, `contexts?`)
- [x] 1.4 Update `IFlowDocument`: add `groups?: ReadonlyArray<IFlowGroup>`, add `join?: IFlowRole`, remove `cliMode?`, remove flow-level `isolation?`

## 2. Flow Service — Parser and Validator

- [x] 2.1 Remove `parseCliMode()` method from `src/flow/flowService.ts`
- [x] 2.2 Add `parseGroups()` method to parse `groups` array from YAML header
- [x] 2.3 Update `parsePrompt()` to populate `groups` and `join` fields; stop reading `cliMode` and flow-level `isolation`
- [x] 2.4 Update `validate()`: reject `orchestration: cli` with "use 'parallel' instead" message; require `groups` (≥ 2) and `join` when `orchestration: parallel`; require each group has `name` and at least 1 role
- [x] 2.5 Remove `CliMode` from re-exports in `src/flow/flowService.ts`

## 3. Flow Engine — Parallel Execution

- [x] 3.1 Rename `case 'cli':` → `case 'parallel':` in the `switch` block in `src/flow/flowEngine.ts`
- [x] 3.2 Replace `executeCli()` with `executeParallel()` that iterates over `config.groups`, running each group's roles sequentially and catching group-level failures
- [x] 3.3 In `executeParallel()`, collect each group's output (or failure notice `⚠ Group failed: <error>`) into a `Map<string, string>` keyed by group name
- [x] 3.4 Build structured join context: convert group output map to labeled `ContextFile[]` entries (`[Group: <name>]`)
- [x] 3.5 Execute the `join` role using `callRole()` with the labeled group context files injected
- [x] 3.6 Stream group progress headers and join role header to the chat response

## 4. JSON Schema

- [x] 4.1 Update `orchestration` enum in `schemas/flow.schema.json` from `["sequence", "cli"]` to `["sequence", "parallel"]`
- [x] 4.2 Remove `cliMode` property definition from the schema
- [x] 4.3 Remove flow-level `isolation` property definition from the schema
- [x] 4.4 Add `groups` property definition: array of group objects with required `name` and `roles`, optional `isolation`, `model`, `skills`, `contexts`
- [x] 4.5 Add `join` property definition: a single role object (reuse/reference `$ref` to existing role definition)

## 5. Example Files and Documentation

- [x] 5.1 Update `examples/cli-autonomous-worktree.flow.yaml`: rename `orchestration: cli` → `orchestration: parallel`, remove `cliMode`, move `isolation` into each group entry
- [x] 5.2 Update `examples/cli-supervised-workspace.flow.yaml`: same changes as 5.1; add a `groups` structure and `join` role to demonstrate the fork-join pattern
- [x] 5.3 Update `docs/FLOW_SCHEMA.md`: update `orchestration` enum docs, remove `cliMode` docs, add `groups` and `join` field documentation
- [x] 5.4 Update `docs/11-cli-delegation-background-agents.md` title and references to use `parallel` terminology

## 6. Tests

- [x] 6.1 Update `src/flow/flowParticipant.spec.ts`: replace `orchestration: 'cli'` fixtures with `orchestration: 'parallel'`; remove `cliMode` assertions
- [x] 6.2 Add unit tests for `FlowService.validate()`: `parallel` without groups fails, `parallel` without join fails, group with no roles fails, `cli` value rejected
- [x] 6.3 Add unit tests for `executeParallel()`: groups run in order, failed group yields failure notice, join role receives all group context files
