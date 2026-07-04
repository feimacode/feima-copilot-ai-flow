---
title: Settings
description: Configure AI Flow behavior — tool rounds, confidence thresholds, token budgets, and generation retries
---

## Overview

AI Flow exposes six settings under the `aiFlow` configuration section. These control execution limits, flow matching behavior, and authoring parameters. All settings have sensible defaults — you only need to change them when your use case requires different behavior.

Open the VS Code Settings UI (`Ctrl+,` / `Cmd+,`) and search for `aiFlow` to see all available options, or edit your `settings.json` directly.

## Execution Settings

### `aiFlow.maxToolRounds`

**Default:** `100` · **Range:** `1–500`

Maximum tool-calling loop iterations per role before the engine stops and reports the result.

Each role in a flow can call tools (read files, search, create files, etc.) in a loop. This setting caps how many times the model can call tools before the engine terminates the loop.

**When to increase:**
- Roles that need to modify many files in one pass
- Complex refactoring tasks that require extensive file exploration
- When you see "tool round limit reached" messages before the role completes its work

**When to decrease:**
- To prevent runaway tool loops on simple tasks
- To reduce token costs on flows where roles tend to over-explore
- When you want faster feedback and are willing to accept incomplete work

**Example:**
```json
{
  "aiFlow.maxToolRounds": 200
}
```

### `aiFlow.maxToolCount`

**Default:** `128` · **Range:** `1–128`

Maximum number of tools sent to the LLM in a single request. When the available tool count exceeds this threshold, smart filtering keeps only the most relevant tools for the current role and context.

This setting exists because some models have limits on how many tools they can handle in a single request, and sending too many tools can degrade the model's ability to choose the right one.

**When to decrease:**
- When using models with smaller tool-handling capacity
- To reduce token usage on each request
- When you notice the model picking wrong tools due to overload

**When to keep at default:**
- Most use cases — the default of 128 covers all built-in tools with room to spare

**Example:**
```json
{
  "aiFlow.maxToolCount": 64
}
```

### `aiFlow.toolInvokeTokenBudget`

**Default:** `4000` · **Range:** `100–16000`

Token budget reserved for tool invocation result content. When a tool returns output (file contents, search results, terminal output), this budget controls how much of that output is included in the prompt.

If a tool's output exceeds this budget, it will be truncated. This prevents a single large file read from consuming the entire context window.

**When to increase:**
- When working with large files and you need the full content in context
- When search results are being truncated and missing critical matches
- When using models with large context windows that can accommodate more tool output

**When to decrease:**
- To reduce token costs on flows where tool output is verbose but only partially relevant
- When working with models that have smaller context windows
- To force roles to be more selective about which files they read

**Trade-off:** Higher budgets give roles more context but cost more tokens per tool call. Lower budgets save tokens but may cause roles to miss important information.

**Example:**
```json
{
  "aiFlow.toolInvokeTokenBudget": 8000
}
```

## Flow Matching Settings

These settings control the automatic flow detection behavior — when you type a query in Copilot chat, AI Flow can suggest relevant flows from your library.

### `aiFlow.flowMatch.confidenceThreshold`

**Default:** `0.8` · **Range:** `0.0–1.0`

Score threshold above which a flow match auto-executes without confirmation.

When you type a message in Copilot chat, AI Flow scores it against available flows. If the score exceeds this threshold, the flow runs immediately — no need to manually select it.

**When to increase (e.g., `0.9`):**
- To reduce false positives — only the most confident matches auto-run
- When flows are expensive and you want to confirm before execution
- When your flow library has many similar flows that could be confused

**When to decrease (e.g., `0.6`):**
- To enable more auto-execution for well-defined flows
- When you're confident in flow matching accuracy
- To speed up workflows where the same flow is always the right choice

**When to set to `1.0`:**
- To disable auto-execution entirely — every flow match requires manual confirmation

**Example:**
```json
{
  "aiFlow.flowMatch.confidenceThreshold": 0.9
}
```

### `aiFlow.flowMatch.minScore`

**Default:** `0.5` · **Range:** `0.0–1.0`

Minimum score to include a flow match in the results list.

This controls the floor for flow suggestions. Flows scoring below this threshold won't appear in the suggestion list at all.

**When to increase:**
- To reduce noise in flow suggestions — only show highly relevant flows
- When you have a large flow library and want to surface only the best matches

**When to decrease:**
- To show more potential matches, even if they're not perfect fits
- When exploring flows and you want to see broader suggestions

**Relationship with `confidenceThreshold`:** `minScore` controls what appears in the list; `confidenceThreshold` controls what auto-runs. Always set `minScore` ≤ `confidenceThreshold`.

**Example:**
```json
{
  "aiFlow.flowMatch.minScore": 0.3
}
```

## Authoring Settings

### `aiFlow.maxGenerationRetries`

**Default:** `3` · **Range:** `1–10`

Maximum retry rounds when the LLM produces invalid YAML during `@flow /create` or `@flow /enhance`.

When you use natural language flow authoring, the model generates YAML output. If the YAML is invalid, the engine retries with error feedback. This setting controls how many retries are attempted before giving up.

**When to increase:**
- When using models that struggle with YAML formatting
- When creating complex flows with many roles and stages
- When you frequently see "YAML generation failed" errors

**When to decrease:**
- To get faster feedback when authoring fails — you'll know sooner that the model can't produce valid YAML
- To reduce token costs on authoring attempts that are unlikely to succeed

**Example:**
```json
{
  "aiFlow.maxGenerationRetries": 5
}
```

## Quick Reference

| Setting | Default | Range | Controls |
|---------|---------|-------|----------|
| `maxToolRounds` | 100 | 1–500 | Tool-calling loop cap per role |
| `maxToolCount` | 128 | 1–128 | Max tools sent before smart filtering |
| `toolInvokeTokenBudget` | 4000 | 100–16000 | Token budget for tool output content |
| `flowMatch.confidenceThreshold` | 0.8 | 0.0–1.0 | Auto-execute threshold for flow matching |
| `flowMatch.minScore` | 0.5 | 0.0–1.0 | Minimum score for flow suggestions |
| `maxGenerationRetries` | 3 | 1–10 | Retries for invalid YAML in /create / /enhance |

## Recommended Profiles

### Cost-Conscious

For teams watching token spend:

```json
{
  "aiFlow.maxToolRounds": 50,
  "aiFlow.maxToolCount": 64,
  "aiFlow.toolInvokeTokenBudget": 2000,
  "aiFlow.flowMatch.confidenceThreshold": 0.9,
  "aiFlow.maxGenerationRetries": 2
}
```

### Power User

For complex flows and large codebases:

```json
{
  "aiFlow.maxToolRounds": 200,
  "aiFlow.maxToolCount": 128,
  "aiFlow.toolInvokeTokenBudget": 8000,
  "aiFlow.flowMatch.confidenceThreshold": 0.7,
  "aiFlow.maxGenerationRetries": 5
}
```

### Conservative (No Auto-Execute)

For full manual control over every flow execution:

```json
{
  "aiFlow.flowMatch.confidenceThreshold": 1.0,
  "aiFlow.flowMatch.minScore": 0.5
}
```
