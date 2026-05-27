## Context

The flow engine currently dispatches execution via a top-level `orchestration:` string field (`sequence` | `parallel` | `cli`). This couples two orthogonal concerns: the *structural pattern* of the flow (how roles are arranged) and the *execution path* of each role (which runtime handles the LM call). The result is that all roles in a flow share a single execution path — you cannot have some roles run via the VS Code LM API while others delegate to the Copilot SDK agent runtime.

Additionally, the term `agent:` is overloaded: at the role level it already means "use this `.agent.md` file as the system prompt content source," but there is no clear way to express "delegate this role's execution to an autonomous agent runtime."

No canonical reference document exists defining what the design primitives are, what they mean, and how they relate to each other — creating confusion for both human authors writing `.flow.yaml` files and AI agents modifying the codebase.

## Goals / Non-Goals

**Goals:**
- Remove `orchestration:` field; make structural pattern implicit from root keys
- Add `delegate: true` as an orthogonal execution-path annotation on any role
- Rename engine methods to reflect what they do, not what config key they consume
- Create canonical primitive definitions in both AI-readable (AGENTS.md) and human-readable (`docs/FLOW_PRIMITIVES.md`) formats
- Migrate all existing `.flow.yaml` examples to the new schema

**Non-Goals:**
- True concurrent/async group execution (groups still run sequentially in the engine loop)
- Stage-level delegation (`stage.delegate:`) — deferred until concrete use case arises
- Changing how `agent:` works as a content source on roles

## Decisions

### D1: Root key determines structural pattern (not `orchestration:`)

**Decision**: Remove `orchestration:` entirely. The presence of `roles:`, `stages:`, or `groups:` + `join:` at the root determines which engine method runs.

| Root key present        | Engine method       | Pattern       |
|-------------------------|---------------------|---------------|
| `roles:`                | `executePipeline`   | Pipeline      |
| `stages:`               | `executeIterative`  | Iterative     |
| `groups:` + `join:`     | `executeForkJoin`   | Fork-join     |

**Rationale**: Consistent with how the schema already uses key presence to determine behavior (`stage.roles:` vs `stage.agent:` was proposed). Eliminates the need for a separate mode field. Validated at parse time — exactly one root structure key must be present.

**Alternative considered**: Keep `orchestration:` as optional with auto-detection as fallback. Rejected: two sources of truth for the same thing creates ambiguity and parsing complexity.

### D2: `delegate: true` is a role-level annotation, not a group-level concept

**Decision**: Add `delegate?: boolean` to `IFlowRole`. When `true`, the engine calls `callRoleAgent()` instead of `callRole()` for that role.

**Rationale**: Roles are the atomic execution unit throughout all three structural patterns. Making delegation a role property keeps it orthogonal to structure. Attempting to make delegation a group-level property (`group.agent:` replacing `group.roles:`) would break the invariant that groups always contain `roles:`, and would re-introduce the "single instance vs multi-instance" inconsistency.

**Key distinction preserved**: `agent:` on a role = content source (load `.agent.md` as prompt body). `delegate: true` = execution path (use Copilot SDK runtime). These are independent axes.

**Alternative considered**: Group-level `agent:` field (no `roles:` needed). Rejected: inconsistent with existing schema structure; confusing collision with role-level `agent:` meaning.

### D3: Engine method names reflect shape, not config key

| Old name             | New name            | Rationale                                              |
|----------------------|---------------------|--------------------------------------------------------|
| `executeSequential`  | `executePipeline`   | "Pipeline" describes the shape (A→B→C), not just order |
| `executeStages`      | `executeIterative`  | "Iterative" captures the loop+convergence nature       |
| `executeParallel`    | `executeForkJoin`   | Accurate: groups don't run concurrently; it's fork+join |
| `callRoleSdk`        | `callRoleAgent`     | "Agent" describes what runs (autonomous agent runtime) |

### D4: Documentation lives in two places with distinct purposes

**Decision**: 
- `AGENTS.md` gets a new **Flow Execution Primitives** section: precise, terse, mapping-table format for AI agents
- `docs/FLOW_PRIMITIVES.md` is a new file: conceptual mental model, ASCII diagrams, YAML examples for humans

**Rationale**: The two audiences have different needs. AI agents need unambiguous mappings and "what NOT to confuse" callouts. Humans need the "why" and visual mental models. They don't duplicate — they serve different levels of abstraction.

### D5: `callRoleAgent` accepts `contextFiles`

**Decision**: Extend the `callRoleAgent` (formerly `callRoleSdk`) signature to accept `contextFiles: ContextFile[]`. The SDK executor serializes them into `sharedContext` before the call.

**Rationale**: For a delegated role in a group context, the group's `contexts:` need to reach the agent. The current `callRoleSdk` signature drops them. The simplest fix is serialization into `sharedContext` rather than changing the SDK executor's internal contract.

## Risks / Trade-offs

- **Breaking change for all existing `.flow.yaml` files** → Mitigation: provide migration guide in FLOW_PRIMITIVES.md; update all bundled examples atomically in this change
- **`orchestration: cli` had a distinct behavior (all roles via SDK)** → Mitigation: `cli`-style flows can be expressed as a pipeline where every role has `delegate: true`; document the migration pattern explicitly
- **`delegate: true` with no `agent:` content** → The role runs via SDK with an inline `prompt:` — valid and supported; the SDK executor uses whatever prompt string it receives
- **Schema JSON validation of root key XOR** — JSON Schema `oneOf` or `if/then/else` required; `flow.schema.json` needs careful authoring to avoid false positives on partial docs

## Migration Plan

1. Update `schemas/flow.schema.json` — remove `orchestration`, add `delegate`, add root key XOR validation
2. Update `src/types/flowDocument.ts` — type changes
3. Update `src/flow/flowService.ts` — parser and validator
4. Update `src/flow/flowEngine.ts` — rename methods, update dispatch
5. Migrate `examples/*.flow.yaml` — remove `orchestration:` field from all
6. Update `AGENTS.md` — add primitives section
7. Create `docs/FLOW_PRIMITIVES.md`

Rollback: the old `orchestration:` field is simply absent from new files. The parser can be made backward-compatible during a transition window by accepting `orchestration:` as deprecated (emit a warning, continue parsing).

## Open Questions

- Should the parser emit a deprecation warning (not error) for existing files that still have `orchestration:` during a transition period, rather than hard-failing? This would ease migration for users with existing flows outside the examples directory.
- `orchestration: cli` is documented in `docs/11-cli-delegation-background-agents.md` — does that doc need updating as part of this change or as a follow-on?
