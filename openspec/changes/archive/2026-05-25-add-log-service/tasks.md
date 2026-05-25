## 1. Log Infrastructure

- [x] 1.1 Copy `src/platform/log/common/logService.ts` from `feima-copilot-llms-extension` into `feima-copilot-ai-flow/src/platform/log/common/logService.ts`
- [x] 1.2 Copy `src/platform/log/vscode/logService.ts` from `feima-copilot-llms-extension` into `feima-copilot-ai-flow/src/platform/log/vscode/logService.ts`
- [x] 1.3 Add `NullLogService` class to `src/platform/log/common/logService.ts` — all methods are no-ops, satisfies `ILogService`

## 2. Extension Activation

- [x] 2.1 In `src/extension.ts`: create `vscode.window.createOutputChannel('Copilot AI Flow', { log: true })`
- [x] 2.2 In `src/extension.ts`: construct `LogServiceImpl([new VSCodeLogTarget(channel), new ConsoleLogTarget('[Flow] ', LogLevel.Error)])`
- [x] 2.3 In `src/extension.ts`: replace `console.log` activation/deactivation calls with `logService.info()`
- [x] 2.4 In `src/extension.ts`: pass `logService` to `FlowParticipant` constructor

## 3. FlowParticipant

- [x] 3.1 Add `ILogger` parameter to `FlowParticipant` constructor; call `log.createSubLogger('FlowParticipant')` internally
- [x] 3.2 Pass sub-loggers to `FlowEngine`, `FlowLibrary`, `FlowDiscoveryService` constructors

## 4. FlowEngine

- [x] 4.1 Add `ILogger` parameter to `FlowEngine` constructor; call `log.createSubLogger('FlowEngine')` internally
- [x] 4.2 Replace all per-tool-round loop `console.log` calls with `this.log.trace()`
- [x] 4.3 Replace structural decision `console.log` calls (prompt rendered, model info, tool counts) with `this.log.debug()`
- [x] 4.4 Replace `console.warn` calls (empty response, max rounds, tool not found) with `this.log.warn()`
- [x] 4.5 Replace `console.error` calls (stream errors, render failures) with `this.log.error()`
- [x] 4.6 Pass sub-logger to `FlowPromptRenderer`, `CopilotSdkExecutor` constructors (created inside `FlowEngine`)

## 5. FlowPromptRenderer

- [x] 5.1 Add `ILogger` parameter to `FlowPromptRenderer` constructor; call `log.createSubLogger('Renderer')` internally
- [x] 5.2 Replace `console.log` calls with `this.log.debug()` or `this.log.trace()` per D5 mapping
- [x] 5.3 Replace `console.warn` and `console.error` calls with appropriate log level calls

## 6. CopilotSdkExecutor and CopilotSdkShims

- [x] 6.1 Add `ILogger` parameter to `CopilotSdkExecutor` constructor; call `log.createSubLogger('SdkExecutor')` internally
- [x] 6.2 Replace all `console.*` calls in `CopilotSdkExecutor` with leveled logger calls
- [x] 6.3 Pass sub-logger from `CopilotSdkExecutor` into `CopilotSdkShims`; replace its `console.*` calls

## 7. FlowDiscoveryService

- [x] 7.1 Add `ILogger` parameter to `FlowDiscoveryService` constructor; call `log.createSubLogger('Discovery')` internally
- [x] 7.2 Replace the single `console.log` call with `this.log.debug()`

## 8. Utility Functions

- [x] 8.1 Add optional `log?: ILogger` parameter to `filterTools()` in `src/util/toolFilter.ts`; replace `console.*` calls to use it when provided
- [x] 8.2 Add optional `log?: ILogger` parameter to `invokeTool()` in `src/util/customToolInvoke.ts`; replace `console.*` calls to use it when provided

## 9. Test Updates

- [x] 9.1 Update `src/flow/flowParticipant.spec.ts` to pass `new NullLogService()` to `FlowParticipant`
- [x] 9.2 Update `src/prompts/flowPromptRenderer.spec.ts` to pass `new NullLogService()` to `FlowPromptRenderer`
- [x] 9.3 Update `src/util/toolFilter.spec.ts` — no change needed (optional param, existing calls still work)
- [x] 9.4 Update any other test files affected by constructor signature changes
- [x] 9.5 Run `npm run compile` and fix any TypeScript errors
- [x] 9.6 Run `npm test` and verify all tests pass
