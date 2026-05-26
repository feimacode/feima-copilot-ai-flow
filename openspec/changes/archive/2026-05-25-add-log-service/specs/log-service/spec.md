## ADDED Requirements

### Requirement: Log infrastructure module
The extension SHALL provide a `src/platform/log/` module containing `ILogService`, `ILogger`, `ILogTarget`, `LogLevel`, `LogServiceImpl`, `VSCodeLogTarget`, `ConsoleLogTarget`, and `NullLogService`.

#### Scenario: Root log service created at activation
- **WHEN** the extension activates
- **THEN** a `LogServiceImpl` is constructed with a `VSCodeLogTarget` (backed by a `vscode.LogOutputChannel` named `"Copilot AI Flow"`) and a `ConsoleLogTarget` that only emits errors

#### Scenario: NullLogService satisfies ILogService
- **WHEN** a unit test constructs any logged class
- **THEN** it SHALL be able to pass `new NullLogService()` without triggering VS Code API calls or producing output

---

### Requirement: Per-class sub-loggers
Each class that performs logging SHALL obtain its logger via `parentLog.createSubLogger('ClassName')` in its constructor. All log messages from that class SHALL be automatically prefixed with `[ClassName]`.

#### Scenario: Sub-logger prefix applied
- **WHEN** `FlowEngine` logs `"Starting tool round 1"`
- **THEN** the output channel SHALL display `[FlowEngine] Starting tool round 1`

#### Scenario: Nested sub-logger
- **WHEN** `CopilotSdkExecutor` logs a message using its sub-logger
- **THEN** the output channel SHALL display `[SdkExecutor] <message>`

---

### Requirement: Log level discipline
Log calls SHALL use the level that matches their semantic weight according to the mapping in design.md D5. In particular:

- Extension lifecycle events (activate/deactivate) SHALL use `info`
- Per-tool-round loop entries and individual tool call events SHALL use `trace`
- Structural per-role decisions and prompt render summaries SHALL use `debug`
- Recoverable anomalies (empty response, max rounds hit, tool not found) SHALL use `warn`
- Failures (stream errors, auth errors, render failures) SHALL use `error`

#### Scenario: Loop log does not appear at default level
- **WHEN** the VS Code Output channel log level is set to `Info` (default)
- **THEN** per-tool-round `trace` messages SHALL NOT appear in the output

#### Scenario: Error always visible
- **WHEN** a stream error occurs during role execution
- **THEN** the error SHALL appear in the output channel regardless of the configured log level

---

### Requirement: Utility functions accept optional logger
`filterTools()` and `invokeTool()` SHALL accept an optional `ILogger` parameter. When the parameter is omitted, the functions SHALL behave identically to their pre-change behavior (no logging side-effects).

#### Scenario: filterTools logs when logger provided
- **WHEN** `filterTools(tools, max, log)` is called with a logger
- **THEN** it SHALL emit a `debug` log noting how many tools were selected

#### Scenario: filterTools works without logger
- **WHEN** `filterTools(tools, max)` is called without a logger
- **THEN** it SHALL return the filtered tools without errors and without any log output
