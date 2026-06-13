## Why

The flow library currently has demo and experimental flows but lacks production-ready workflows that solve real developer problems. The backlog identifies 15 flows ranked by adoption potential; implementing the 6 P1 flows will provide immediate value for code review, sprint planning, incident response, PR generation, and test writing — the highest-frequency developer tasks.

## What Changes

Add 6 production-ready flow files to the built-in library:

- **code-review.flow.yaml** — 3-role pipeline: Logic/Correctness → Style/Security → Verdict
- **story-estimation.flow.yaml** — 4-role pipeline: Complexity → Risk → Dependency → Estimator
- **backlog-ranking.flow.yaml** — 5-role pipeline: Value → Risk → Dependency → Effort → Synthesizer
- **war-room-triage.flow.yaml** — Staged flow: 5 parallel analysts → Customer Communication
- **pr-description.flow.yaml** — 3-role pipeline: Historian → Impact → Writer
- **test-writing.flow.yaml** — 3-role pipeline: Designer → Writer → Edge Case Hunter

Each flow includes:
- Inline prompts defining role perspectives and responsibilities
- Minimal tool sets (readFile, findTextInFiles, and role-specific additions)
- Metadata (category, difficulty, tags) for library discoverability
- Shared context explaining when to use the flow

## Capabilities

### New Capabilities

- `code-review`: Multi-perspective code review with separate lenses for correctness, security, and final verdict
- `story-estimation`: Sprint story sizing with complexity, risk, dependency, and splitting analysis
- `backlog-ranking`: Priority ordering with value, risk, dependency, and effort dimensions
- `war-room-triage`: Incident response with parallel investigation and customer communication stages
- `pr-description`: Automated PR description generation from diff analysis
- `test-writing`: Comprehensive test generation with adversarial edge case hunting

### Modified Capabilities

None — this change adds new flows without modifying existing capabilities.

## Impact

- **Files added**: 6 new `.flow.yaml` files in `examples/`
- **Library**: FlowLibrary will automatically discover and expose these flows via `/list`, `/search`, `/browse`
- **Validation**: All flows must pass JSON Schema validation and FlowService.validate() runtime checks
- **Testing**: Unit tests for structural validation, functional tests for prompt quality
- **No code changes**: Implementation is purely declarative (YAML files)