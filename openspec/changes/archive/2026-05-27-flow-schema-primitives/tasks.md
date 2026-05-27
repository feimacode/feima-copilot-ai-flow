## 1. Type System Changes

- [ ] 1.1 Remove `OrchestrationStrategy` type (or alias) from `src/types/flowDocument.ts`
- [ ] 1.2 Remove `orchestration` field from `IFlowConfig` in `src/types/flowDocument.ts`
- [ ] 1.3 Add `delegate?: boolean` to `IFlowRole` in `src/types/flowDocument.ts`

## 2. Schema Changes

- [ ] 2.1 Remove `orchestration` property from `schemas/flow.schema.json`
- [ ] 2.2 Add `delegate` boolean property to the role object schema in `schemas/flow.schema.json`
- [ ] 2.3 Add root-level `oneOf`/`if-then-else` in `schemas/flow.schema.json` to enforce mutual exclusivity of `roles:`, `stages:`, and `groups:` (exactly one must be present)

## 3. Parser & Validator

- [ ] 3.1 Remove `orchestration` field parsing from `src/flow/flowService.ts` `parsePrompt()`
- [ ] 3.2 Update `src/flow/flowService.ts` `validate()` to enforce the root key XOR rule (error if more than one of `roles:`, `stages:`, `groups:` is present; error if none is present)
- [ ] 3.3 Consider adding a deprecation warning (not hard error) for files that still contain `orchestration:` to ease migration

## 4. Engine Method Renames

- [ ] 4.1 Rename `executeSequential` → `executePipeline` in `src/flow/flowEngine.ts`
- [ ] 4.2 Rename `executeStages` → `executeIterative` in `src/flow/flowEngine.ts`
- [ ] 4.3 Rename `executeParallel` → `executeForkJoin` in `src/flow/flowEngine.ts`
- [ ] 4.4 Rename `callRoleSdk` → `callRoleAgent` in `src/flow/flowEngine.ts`

## 5. Engine Dispatch Logic

- [ ] 5.1 Replace the `switch (config.orchestration)` block in `execute()` with if/else checks on which root key is present (`config.roles`, `config.stages`, `config.groups`)
- [ ] 5.2 Update the `metadata` response in `execute()` to remove `orchestration` from returned metadata
- [ ] 5.3 Remove the `stream.markdown(\`**Mode**: ${config.orchestration}\`)` line in `execute()`

## 6. callRoleAgent: Extend Signature

- [ ] 6.1 Add `contextFiles: ContextFile[]` parameter to `callRoleAgent()` signature
- [ ] 6.2 In `callRoleAgent()`, serialize `contextFiles` into the `sharedContext` string before calling `sdkExecutor.executeCopilotSdk()`
- [ ] 6.3 Update all callers of `callRoleAgent()` (if any exist) to pass `contextFiles`

## 7. delegate Support in Execute Methods

- [ ] 7.1 In `executePipeline()`: for each role, check `role.delegate === true` and call `callRoleAgent()` instead of `callRole()`
- [ ] 7.2 In `executeIterative()`: for each role in each stage iteration, check `role.delegate` and dispatch accordingly
- [ ] 7.3 In `executeForkJoin()`: for each role in each group, check `role.delegate` and dispatch accordingly; also check on the join role

## 8. Example Migration

- [ ] 8.1 Remove `orchestration:` field from `examples/cli-autonomous-worktree.flow.yaml`
- [ ] 8.2 Remove `orchestration:` field from `examples/cli-supervised-workspace.flow.yaml`
- [ ] 8.3 Remove `orchestration:` field from `examples/prompt-file-demo.flow.yaml`
- [ ] 8.4 Audit all other `.flow.yaml` files in the repo and remove `orchestration:` from each

## 9. Documentation

- [ ] 9.1 Create `docs/FLOW_PRIMITIVES.md` with: three structural pattern sections (pipeline/iterative/fork-join), ASCII diagrams, YAML examples, two-axis orthogonality explanation, inheritance chain, migration guide from `orchestration:`
- [ ] 9.2 Add **Flow Execution Primitives** section to `AGENTS.md` containing: schema→engine dispatch table, two-axis role table, `delegate: true` dispatch summary, context/skills inheritance chain, Key Distinctions callout
- [ ] 9.3 Update `docs/11-cli-delegation-background-agents.md` to reflect the new `delegate: true` annotation replacing `orchestration: cli`

## 10. Verification

- [ ] 10.1 Run `npm run compile` with zero errors
- [ ] 10.2 Verify all example `.flow.yaml` files pass schema validation
- [ ] 10.3 Manually test a simple pipeline flow (no delegation) still works end-to-end
- [ ] 10.4 Manually test a flow with `delegate: true` on one role routes through `callRoleAgent()`
