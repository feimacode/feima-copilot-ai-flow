## Why

`feima-copilot-ai-flow` uses raw `console.log/warn/error` calls (~100 across 9 files) as its only logging mechanism. In production these are invisible to users, cannot be filtered by log level, and never appear in VS Code's Output panel. `feima-copilot-llms-extension` already ships a production-ready `ILogService` with VS Code output channel integration and per-topic sub-loggers — we should adopt the same pattern.

## What Changes

- **Add** `src/platform/log/` infrastructure (copied from `feima-copilot-llms-extension`): `ILogService`, `LogLevel`, `ILogTarget`, `VSCodeLogTarget`, `ConsoleLogTarget`, `NullLogService`
- **Add** `NullLogService` stub for unit tests (no-op implementation of `ILogService`)
- **Modify** `extension.ts` to create a root `LogServiceImpl` backed by a `vscode.LogOutputChannel` named `"Copilot AI Flow"`
- **Modify** `FlowParticipant`, `FlowEngine`, `FlowPromptRenderer`, `CopilotSdkExecutor`, `CopilotSdkShims`, `FlowDiscoveryService` — accept `ILogger` in constructors, replace all `console.*` calls with leveled log calls
- **Modify** `toolFilter.ts` and `customToolInvoke.ts` — add optional `ILogger` parameter to exported functions
- **Preserve** existing `console.*` calls in `flowTools.tsx` (TSX prompt components are render-side and not in scope)
- **Update** affected test files to pass `NullLogService` instead of no logger

## Capabilities

### New Capabilities
- `log-service`: Structured, leveled log service with VS Code output channel, topic sub-loggers, and a null stub for tests

### Modified Capabilities
<!-- No existing spec-level capability requirements change -->

## Impact

- **New files**: `src/platform/log/common/logService.ts`, `src/platform/log/vscode/logService.ts`
- **Changed constructors**: `FlowParticipant`, `FlowEngine`, `FlowPromptRenderer`, `CopilotSdkExecutor`, `CopilotSdkShims`, `FlowDiscoveryService`
- **Changed function signatures**: `filterTools()`, `invokeTool()` (optional `ILogger` param — backwards-compatible)
- **Test files updated**: `flowParticipant.spec.ts`, `flowPromptRenderer.spec.ts`, `toolFilter.spec.ts`, `cliSpawner.spec.ts`, `copilotCliExecutor.spec.ts`
- **No new runtime dependencies** — `vscode` and `@vscode/prompt-tsx` already available
