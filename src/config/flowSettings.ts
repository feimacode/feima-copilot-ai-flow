/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Default values — used as fallbacks when settings are not configured
// ---------------------------------------------------------------------------

/** Default max tool-calling loop iterations per role. */
export const DEFAULT_MAX_TOOL_ROUNDS = 100;

/** Default max tools sent to the LLM before smart filtering kicks in. */
export const DEFAULT_MAX_TOOL_COUNT = 128;

/** Default score threshold above which a flow match auto-executes. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

/** Default minimum score to include a flow match in results. */
export const DEFAULT_MIN_SCORE = 0.5;

/** Default max retry rounds when the LLM produces invalid YAML. */
export const DEFAULT_MAX_GENERATION_RETRIES = 3;

/** Default token budget for tool invocation results. */
export const DEFAULT_TOOL_INVOKE_TOKEN_BUDGET = 4000;

// ---------------------------------------------------------------------------
// Settings reader
// ---------------------------------------------------------------------------

const CONFIG_SECTION = 'aiFlow';

function getConfig(): vscode.WorkspaceConfiguration | undefined {
	try {
		return vscode.workspace.getConfiguration(CONFIG_SECTION);
	} catch {
		return undefined;
	}
}

/** Max tool-calling loop iterations per role (1–500). */
export function getMaxToolRounds(): number {
	return getConfig()?.get<number>('maxToolRounds') ?? DEFAULT_MAX_TOOL_ROUNDS;
}

/** Max tools sent to the LLM before smart filtering kicks in (1–128). */
export function getMaxToolCount(): number {
	return getConfig()?.get<number>('maxToolCount') ?? DEFAULT_MAX_TOOL_COUNT;
}

/** Score threshold above which a flow match auto-executes without confirmation (0–1). */
export function getConfidenceThreshold(): number {
	return getConfig()?.get<number>('flowMatch.confidenceThreshold') ?? DEFAULT_CONFIDENCE_THRESHOLD;
}

/** Minimum score to include a flow match in results (0–1). */
export function getMinScore(): number {
	return getConfig()?.get<number>('flowMatch.minScore') ?? DEFAULT_MIN_SCORE;
}

/** Max retry rounds when the LLM produces invalid YAML during /create or /enhance (1–10). */
export function getMaxGenerationRetries(): number {
	return getConfig()?.get<number>('maxGenerationRetries') ?? DEFAULT_MAX_GENERATION_RETRIES;
}

/** Token budget for tool invocation result content (100–16000). */
export function getToolInvokeTokenBudget(): number {
	return getConfig()?.get<number>('toolInvokeTokenBudget') ?? DEFAULT_TOOL_INVOKE_TOKEN_BUDGET;
}
