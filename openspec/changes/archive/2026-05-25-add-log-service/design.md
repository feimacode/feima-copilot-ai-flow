## Context

`feima-copilot-ai-flow` is a VS Code extension that orchestrates multi-role AI flows. Its only current logging mechanism is raw `console.*` calls — no output channel, no log levels, no per-topic prefixing. In production these calls are invisible to users and produce noise in developer consoles with no way to filter them.

`feima-copilot-llms-extension` (a sibling extension in the same workspace) already ships a production-tested `ILogService` with: leveled output (`trace/debug/info/warn/error`), a VS Code `LogOutputChannel` backend, a `ConsoleLogTarget` (errors-only in prod), and composable `SubLogger` instances via `createSubLogger(topic)`. The two extensions are separately published VSIXs with no shared runtime, so code must be copied rather than imported.

The existing console calls already use manual `[Topic]` prefixes (e.g. `[FlowEngine]`, `[FlowPromptRenderer]`) — these map cleanly onto sub-loggers.

## Goals / Non-Goals

**Goals:**
- Users can see extension logs in VS Code's Output panel ("Copilot AI Flow" channel), filtered by log level
- All structured log calls use `ILogger` methods with appropriate levels (trace/debug/info/warn/error)
- Unit tests can construct logged classes without a real VS Code output channel (via `NullLogService`)
- `flowTools.tsx` TSX prompt components are left unchanged (render-side, out of scope)
- Log level conventions: loops and high-frequency render calls → `trace`; structural decisions and per-round summaries → `debug`; lifecycle events → `info`; recoverable anomalies → `warn`; failures → `error`

**Non-Goals:**
- Telemetry or remote log aggregation
- Changing the `feima-copilot-llms-extension` log infrastructure
- Logging inside `flowTools.tsx` or `flowRolePrompt.tsx` TSX components
- Log persistence to disk

## Decisions

### D1: Copy log files, don't share via package

**Decision**: Copy `common/logService.ts` and `vscode/logService.ts` from `feima-copilot-llms-extension` into `src/platform/log/` in this extension.

**Rationale**: The extensions are independently published VSIXs — they cannot share code at runtime. A shared npm package would require monorepo tooling (pnpm workspaces, publish pipeline) that doesn't exist yet. The log module is small (~280 lines), stable, and already carries "adapted from" provenance. Copy is the established pattern (llms-extension itself says "Adapted from feima-code logging infrastructure").

**Alternatives considered**:
- Shared `@feima/log` npm package: correct long-term, premature given workspace maturity
- Inline `vscode.window.createOutputChannel` only: loses sub-logger composition and ILogService testability

---

### D2: Thread `ILogger` via constructor injection, not a global singleton

**Decision**: The root `LogServiceImpl` is created once in `extension.ts` and passed as `ILogger` through constructors: `FlowParticipant(context, log)` → `FlowEngine(log)` → children (`FlowPromptRenderer`, `CopilotSdkExecutor`, `CopilotSdkShims`). Each class calls `log.createSubLogger('ClassName')` in its constructor.

**Rationale**: Matches the pattern in `feima-copilot-llms-extension`. Avoids global mutable state. Makes the dependency explicit and testable. `NullLogService` can be passed in tests with zero boilerplate.

**Alternatives considered**:
- Module-level logger singleton: harder to test, couples module init to VS Code APIs
- Ambient context / service locator: anti-pattern in this codebase

---

### D3: Optional `ILogger` param for module-level utility functions

**Decision**: `filterTools(tools, max, log?: ILogger)` and `invokeTool(name, ..., log?: ILogger)` accept an optional logger. When omitted, logging is skipped silently.

**Rationale**: These are pure utility functions, not classes — wrapping them in a class solely to hold a logger is over-engineering. The optional param is backwards-compatible.

---

### D4: `NullLogService` lives in `src/platform/log/common/logService.ts`

**Decision**: Add a `NullLogService` class (all methods no-op) to the same file as `ILogService`. Tests import it directly.

**Rationale**: Keeps the test utility co-located with the interface it satisfies. No separate test-only file needed.

---

### D5: Log level mapping for existing console calls

| Call pattern | Mapped level |
|---|---|
| Extension activation/deactivation | `info` |
| Per-class lifecycle ("callRole started") | `debug` |
| Per-tool-round loop entries | `trace` |
| Tool call received / completed | `trace` |
| Prompt rendered, message count | `debug` |
| Model/token info | `debug` |
| File resolved/created | `debug` |
| Recoverable empty response, retry | `warn` |
| Missing tool, unmatched tools | `warn` |
| Max rounds hit | `warn` |
| Stream errors, render failures, auth failures | `error` |

## Risks / Trade-offs

- **Drift risk** — The copied log files may diverge from `feima-copilot-llms-extension` over time. Mitigation: keep the files small and stable; revisit if a shared package is ever introduced.
- **Constructor signature changes** — Adding `ILogger` to `FlowEngine`, `FlowParticipant`, etc. breaks any callers outside tests. Mitigation: all internal callers are updated in the same change; no public API is exposed.
- **`flowTools.tsx` console calls remain** — High-frequency render-time diagnostics stay as `console.*`. These were added during debugging and may be pruned in a follow-up, but are out of scope here to keep the change focused.
