/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { renderPrompt } from '@vscode/prompt-tsx';
import { FlowMatchingSkill } from '../prompts/flowMatchingSkill';
import { IFlowEntry } from './flowSource';
import { FlowLibrary } from './flowLibrary';
import { selectModel } from '../util/selectModel';
import { ILogger } from '../platform/log/common/logService';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single match result with score and reasoning. */
export interface IMatchResult {
	/** The matched flow entry. */
	readonly entry: IFlowEntry;
	/** Confidence score from the LLM (0.0–1.0). */
	readonly score: number;
	/** One-sentence explanation of why this flow matches. */
	readonly reasoning: string;
}

/** Outcome of the intent-matching process. */
export interface IMatchOutcome {
	/** Ranked matches (score descending). Empty if nothing matched. */
	readonly matches: readonly IMatchResult[];
	/** True when the top match score ≥ the confidence threshold (0.8). */
	readonly confident: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Score threshold above which we auto-execute without confirmation. */
const CONFIDENCE_THRESHOLD = 0.8;

/** Minimum score to include a flow in results. */
const MIN_SCORE = 0.5;

// ---------------------------------------------------------------------------
// FlowMatcher
// ---------------------------------------------------------------------------

/**
 * Matches a freeform user prompt to the best workspace flow(s) using an LLM.
 *
 * Uses a Prompt-TSX skill ({@link FlowMatchingSkill}) to instruct the language
 * model to score each available flow against the user's request. Returns ranked
 * matches if the model is confident, or an empty outcome if nothing fits.
 */
export class FlowMatcher {
	private readonly log: ILogger;

	constructor(private readonly library: FlowLibrary, log: ILogger) {
		this.log = log;
	}

	/**
	 * Match the user's prompt against available workspace flows.
	 *
	 * @param prompt The user's natural language request.
	 * @param userModel The model selected by the user (or undefined for default).
	 * @param token Cancellation token.
	 * @returns Ranked matches and confidence flag.
	 */
	async matchByIntent(
		prompt: string,
		userModel: vscode.LanguageModelChat,
		token: vscode.CancellationToken
	): Promise<IMatchOutcome> {
		// 1. Gather workspace flows
		const all = await this.library.getAll();
		const workspaceFlows = all.filter(f => f.source === 'workspace');

		if (workspaceFlows.length === 0) {
			this.log.info('FlowMatcher: no workspace flows — skipping intent matching');
			return { matches: [], confident: false };
		}

		// 2. Select a model
		const model = await selectModel(undefined, userModel, this.log);
		if (!model) {
			this.log.error('FlowMatcher: no language model available');
			return { matches: [], confident: false };
		}

		this.log.info(`FlowMatcher: matching "${prompt.substring(0, 80)}" against ${workspaceFlows.length} workspace flows using ${model.name}`);

		// 3. Serialise flows to JSON for the LLM prompt (only the fields it needs)
		const flowsJson = JSON.stringify(
			workspaceFlows.map(f => ({
				id: f.id,
				name: f.name,
				description: f.description ?? '',
				tags: f.tags ?? [],
				category: f.category ?? '',
				orchestration: f.orchestration ?? '',
				sharedContext: f.sharedContext ? f.sharedContext.substring(0, 500) : '',
			}))
		);

		// 4. Build custom tokenizer (same pattern as FlowPromptRenderer)
		const customTokenizer = {
			mode: 4,
			tokenLength: async (part: { type: number; text?: string }) => {
				if (part.type === 1 && part.text) {
					return Math.ceil(part.text.length / 4);
				}
				return 0;
			},
			countMessageTokens: async (_message: vscode.LanguageModelChatMessage) => {
				// Not called directly by our render path — safe fallback
				return 100;
			}
		};

		// 5. Render the matching skill prompt
		const maxPromptTokens = Math.max(8192, (model.maxInputTokens || 32768) - 4096);
		const { messages } = await renderPrompt(
			FlowMatchingSkill,
			{ prompt, flows: flowsJson },
			{ modelMaxPromptTokens: maxPromptTokens },
			customTokenizer as unknown as vscode.LanguageModelChat
		);

		if (token.isCancellationRequested) {
			return { matches: [], confident: false };
		}

		// 6. Send to LLM
		let rawResponse = '';
		try {
			const response = await model.sendRequest(messages, {}, token);
			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					rawResponse += chunk.value;
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.log.error(`FlowMatcher: model request failed — ${msg}`);
			if (msg.includes('cancel') || msg.includes('Cancel')) {
				return { matches: [], confident: false };
			}
			// Non-cancellation errors: proceed with empty matches
			return { matches: [], confident: false };
		}

		if (token.isCancellationRequested) {
			return { matches: [], confident: false };
		}

		// 7. Parse the JSON response
		const matches = this._parseResponse(rawResponse, workspaceFlows);
		const confident = matches.length > 0 && matches[0].score >= CONFIDENCE_THRESHOLD;

		this.log.info(`FlowMatcher: ${matches.length} matches, confident=${confident}`);
		if (matches.length > 0) {
			this.log.trace(`FlowMatcher: top match — ${matches[0].entry.id} (${matches[0].score})`);
		}

		return { matches, confident };
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	/**
	 * Parse the LLM's JSON response and cross-reference with workspace flows.
	 * Handles markdown fences, leading/trailing non-JSON text, and partial results.
	 */
	private _parseResponse(raw: string, workspaceFlows: readonly IFlowEntry[]): IMatchResult[] {
		const flowMap = new Map(workspaceFlows.map(f => [f.id, f]));

		// Extract JSON array — handle markdown fences
		let json = raw.trim();

		// Strip markdown fences if present
		const fenceMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
		if (fenceMatch) {
			json = fenceMatch[1].trim();
		} else {
			// Try to find a JSON array bracket
			const bracketStart = json.indexOf('[');
			const bracketEnd = json.lastIndexOf(']');
			if (bracketStart >= 0 && bracketEnd > bracketStart) {
				json = json.substring(bracketStart, bracketEnd + 1);
			}
		}

		try {
			const parsed = JSON.parse(json);
			if (!Array.isArray(parsed)) {
				this.log.error('FlowMatcher: response is not a JSON array');
				return [];
			}

			const results: IMatchResult[] = [];
			for (const item of parsed) {
				if (!item || typeof item !== 'object') { continue; }
				const id = String(item.id ?? '');
				const score = Number(item.score ?? 0);
				const reasoning = String(item.reasoning ?? '');

				if (!id || isNaN(score) || score < MIN_SCORE) { continue; }

				const entry = flowMap.get(id);
				if (entry) {
					results.push({ entry, score: Math.min(1, Math.max(0, score)), reasoning });
				} else {
					this.log.trace(`FlowMatcher: LLM returned unknown flow id "${id}" — skipping`);
				}
			}

			// Sort by score descending
			results.sort((a, b) => b.score - a.score);
			return results;
		} catch (err) {
			this.log.error(`FlowMatcher: JSON parse error — ${err instanceof Error ? err.message : String(err)}`);
			this.log.trace(`FlowMatcher: raw response (first 500 chars): ${raw.substring(0, 500)}`);
			return [];
		}
	}
}
