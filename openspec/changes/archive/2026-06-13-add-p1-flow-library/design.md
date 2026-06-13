## Context

The Copilot AI Flow extension provides a flow library that scans `examples/*.flow.yaml` files and exposes them via the `@flow` participant. Currently, the library contains demo flows (sequence-basic, prompt-file-demo, cli-autonomous-worktree) but lacks production workflows for common developer tasks.

The backlog analysis identified 15 flows ranked by adoption potential. P1 flows target high-frequency tasks: code review, sprint planning, incident response, PR generation, and test writing. Each flow uses the existing execution primitives (pipeline, staged, fork-join) and must conform to the JSON schema at `schemas/flow.schema.json`.

## Goals / Non-Goals

**Goals:**
- Add 6 production-ready flow files validated against the schema
- Each flow has well-crafted inline prompts defining role perspectives
- Minimal tool sets per role (conservative approach)
- Flows are discoverable in the library view (category, difficulty, tags)
- Unit tests verify structural correctness
- Functional tests verify prompt quality with sample inputs

**Non-Goals:**
- No changes to FlowEngine, FlowService, or FlowLibrary code
- No new execution primitives or schema extensions
- No model overrides (users choose via VS Code settings)
- No external prompt/agent files (all inline)
- No P2 or P3 flows (future work)

## Decisions

### 1. Prompt Location: Inline vs External Files
**Decision**: Inline prompts embedded in each `.flow.yaml` file.

**Rationale**:
- Self-contained flows are easier to share and install
- P1 prompts are domain-specific, not reusable across flows
- Inline prompts enable faster iteration during prompt engineering
- External files add complexity without benefit for these flows

**Alternatives considered**:
- External `.prompt.md` files: Better for reusable prompts, but P1 roles are specialized
- Hybrid approach: Adds complexity; no roles benefit from external files

### 2. Tool Selection: Minimal vs Full Access
**Decision**: Minimal tool sets per role (conservative).

**Rationale**:
- Reduces cognitive load on the model (focused tool set)
- Avoids accidental side effects from overly broad permissions
- Each role gets tools it NEEDS, not all available tools
- Security-conscious: code review roles don't need write tools

**Alternatives considered**:
- `["*"]` for all roles: Too permissive, risks unintended modifications
- Flow-level tools only: Less granular, can't differentiate role needs

### 3. Model Overrides: Flow-specified vs User-controlled
**Decision**: No model overrides in flow files.

**Rationale**:
- Model selection is user preference (GPT vs Claude)
- Cost consideration (Opus is expensive)
- Availability varies by user (not all models available to everyone)
- VS Code settings already provide model selection mechanism

**Alternatives considered**:
- Flow-level model: Forces all users to same model (bad for cost/availability)
- Role-level models: Could differentiate (e.g., Edge Case Hunter uses different model), but adds complexity without clear benefit

### 4. Execution Modes per Flow
**Decision**: Use appropriate mode based on flow semantics.

| Flow | Mode | Rationale |
|------|------|-----------|
| Code Review | Pipeline (roles) | Sequential lenses build on each other |
| Story Estimation | Pipeline (roles) | Sequential analysis → estimation |
| Backlog Ranking | Pipeline (roles) | Sequential analysis → synthesis |
| War-Room Triage | Staged (stages) | Parallel investigation → communication |
| PR Description | Pipeline (roles) | Sequential analysis → writing |
| Test Writing | Pipeline (roles) | Sequential design → write → challenge |

**Alternatives considered**:
- All pipeline: War-Room Triage loses parallelism benefit
- Fork-join for Test Writing: Edge Case Hunter should challenge AFTER Writer, not parallel

### 5. Testing Strategy
**Decision**: Unit tests (structural) + functional tests (prompt quality).

**Rationale**:
- Unit tests verify schema compliance and FlowService.validate() passes
- Functional tests run each flow with sample inputs to verify prompt effectiveness
- Integration tests (full execution) are expensive; functional tests provide good coverage

**Alternatives considered**:
- Only unit tests: Doesn't verify prompt quality
- Full integration tests: Too slow for batch implementation
- No tests: Risks shipping invalid flows

## Risks / Trade-offs

### Risk: Prompts may not produce expected outputs
**Mitigation**: Functional tests with sample inputs; iterate on prompts based on results

### Risk: Tool sets may be too restrictive
**Mitigation**: Start minimal; expand if functional tests show roles need more tools

### Risk: Flows may not match user mental models
**Mitigation**: Shared context sections explain when to use each flow; clear role names

### Trade-off: Inline prompts are harder to reuse
**Acceptance**: P1 roles are specialized; reusability isn't a goal for this change

### Trade-off: No model overrides may limit optimization
**Acceptance**: User control is more important than flow-level optimization