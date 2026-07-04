/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ILogger } from '../platform/log/common/logService';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parsed model override from a flow YAML `model:` field.
 *
 * The raw string is split on the **first** `"."`:
 * - `"copilot.gpt-4o"` → `{ vendor: "copilot", modelPattern: "gpt-4o" }`
 * - `"copilot.*"`     → `{ vendor: "copilot", modelPattern: "*" }`
 * - `"gpt-*"`        → `{ modelPattern: "gpt-*" }`
 * - `"claude-sonnet-4.5"` → `{ modelPattern: "claude-sonnet-4.5" }`
 *
 * Returns `null` for empty / blank / whitespace-only strings.
 */
export function parseModelOverride(raw: string): { vendor?: string; modelPattern: string } | null {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const dotIdx = trimmed.indexOf('.');
	if (dotIdx === -1) {
		return { modelPattern: trimmed };
	}

	const vendor = trimmed.substring(0, dotIdx);
	const modelPattern = trimmed.substring(dotIdx + 1);

	// If vendor or pattern is empty (e.g. "copilot." or ".gpt-4o"), treat whole string as modelPattern
	if (vendor.length === 0 || modelPattern.length === 0) {
		return { modelPattern: trimmed };
	}

	return { vendor, modelPattern };
}

/**
 * Select a chat model using a priority chain that short-circuits
 * via targeted API queries to avoid loading every provider's models:
 *
 * 1. Match `preferredModelId` — exact id, vendor+id, or glob pattern
 * 2. Match `userSelectedModel` by vendor + id — {@link vscode.lm.selectChatModels}({ vendor, id })
 * 3. If either id had an exact miss, fall back to fuzzy match across all models (fetched once)
 * 4. Copilot-vendor models — {@link vscode.lm.selectChatModels}({ vendor: 'copilot' })
 * 5. Last resort: fetch all models — {@link vscode.lm.selectChatModels}()
 *
 * Returns `undefined` when no language models are registered at all.
 */
export async function selectModel(
	preferredModelId?: string,
	userSelectedModel?: vscode.LanguageModelChat,
	log?: ILogger
): Promise<vscode.LanguageModelChat | undefined> {
	// Pool of ids that need fuzzy lookup after exact-id queries fail
	const fuzzyQueue: string[] = [];

	// 1. Preferred model — exact id, vendor+id, or glob pattern
	if (preferredModelId) {
		const selector = parseModelOverride(preferredModelId);
		if (selector) {
			const match = await _resolveModelSelector(selector, log);
			if (match) {
				log?.info(`selectModel: step 1 hit — ${match.name}(${match.id})`);
				return match;
			}
			log?.trace(`selectModel: step 1 miss for "${preferredModelId}"`);

			// Only queue for step-3 fuzzy fallback when the pattern is literal (no glob).
			// Glob patterns like "gpt-*" would never produce a useful fuzzy match.
			if (!_isGlob(selector.modelPattern)) {
				fuzzyQueue.push(preferredModelId);
			}
		}
	}

	// 2. User's currently selected model in the chat UI — by vendor + id
	if (userSelectedModel) {
		log?.trace(`selectModel: step 2 — querying by vendor="${userSelectedModel.vendor}" id="${userSelectedModel.id}"`);
		const [match] = await vscode.lm.selectChatModels({
			vendor: userSelectedModel.vendor,
			id: userSelectedModel.id,
		});
		if (match) {
			log?.info(`selectModel: step 2 hit — ${match.name}(${match.id})`);
			return match;
		}
		log?.trace(`selectModel: step 2 miss for "${userSelectedModel.id}" vendor="${userSelectedModel.vendor}"`);
		fuzzyQueue.push(userSelectedModel.id);
	}

	// 3. Fuzzy search across all models (single fetch for all queued ids)
	if (fuzzyQueue.length > 0) {
		log?.trace(`selectModel: step 3 — fuzzy search for [${fuzzyQueue.join(', ')}]`);
		const all = await vscode.lm.selectChatModels();
		log?.trace(`selectModel: step 3 — fetched ${all.length} models`);
		for (const id of fuzzyQueue) {
			const match = _findFuzzy(all, id);
			if (match) {
				log?.info(`selectModel: step 3 hit — ${match.name}(${match.id}) fuzzy match for "${id}"`);
				return match;
			}
		}
		// If fuzzy failed but we already fetched all models, use them for fallback
		if (all.length > 0) {
			log?.info(`selectModel: step 3 fallback — ${all[0].name}(${all[0].id})`);
			return all[0];
		}
	}

	// 4. Copilot-vendor models (cheaper than fetching all providers)
	log?.trace('selectModel: step 4 — querying copilot vendor');
	const copilotModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
	if (copilotModels.length > 0) {
		log?.info(`selectModel: step 4 hit — ${copilotModels[0].name}(${copilotModels[0].id})`);
		return copilotModels[0];
	}

	// 5. Last resort: any model
	log?.trace('selectModel: step 5 — querying all models');
	const allModels = await vscode.lm.selectChatModels();
	if (allModels.length > 0) {
		log?.info(`selectModel: step 5 hit — ${allModels[0].name}(${allModels[0].id})`);
		return allModels[0];
	}

	log?.error('selectModel: no models available');
	return undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a parsed model selector.
 *
 * Dispatch table:
 * | vendor | glob | strategy |
 * |--------|------|----------|
 * | no     | no   | exact id lookup — `selectChatModels({ id })` |
 * | yes    | no   | vendor+id → vendor-scoped fuzzy |
 * | yes    | yes  | vendor-scoped glob filter |
 * | no     | yes  | all-models glob filter |
 */
async function _resolveModelSelector(
	selector: { vendor?: string; modelPattern: string },
	log?: ILogger
): Promise<vscode.LanguageModelChat | undefined> {
	const { vendor, modelPattern } = selector;
	const isGlob = _isGlob(modelPattern);

	if (!isGlob) {
		// ── Exact (literal) path ──────────────────────────────────────
		if (vendor) {
			// vendor.model — try vendor+id first
			log?.trace(`selectModel: step 1a — querying vendor="${vendor}" id="${modelPattern}"`);
			const [match] = await vscode.lm.selectChatModels({ vendor, id: modelPattern });
			if (match) {
				return match;
			}
			// Try vendor-scoped family/name match before giving up
			log?.trace(`selectModel: step 1b — vendor-scoped fuzzy for vendor="${vendor}" pattern="${modelPattern}"`);
			const vendorModels = await vscode.lm.selectChatModels({ vendor });
			return _findFuzzy(vendorModels, modelPattern);
		} else {
			// Bare id — exact lookup (preserves current behaviour)
			log?.trace(`selectModel: step 1a — querying by id="${modelPattern}"`);
			const [match] = await vscode.lm.selectChatModels({ id: modelPattern });
			return match;
		}
	} else {
		// ── Glob / pattern path ───────────────────────────────────────
		const models = vendor
			? await vscode.lm.selectChatModels({ vendor })
			: await vscode.lm.selectChatModels();

		log?.trace(`selectModel: step 1a — glob filter vendor="${vendor ?? '*'}" pattern="${modelPattern}" across ${models.length} models`);

		return _matchGlobPattern(models, modelPattern);
	}
}

/** Check whether a pattern string contains a glob wildcard (`*`). */
function _isGlob(pattern: string): boolean {
	return pattern.includes('*');
}

/** Case-insensitive glob match. Only `*` is supported (matches any sequence of characters). */
function _matchesGlob(pattern: string, candidate: string): boolean {
	const p = pattern.toLowerCase();
	const c = candidate.toLowerCase();

	if (p === '*') {
		return true;
	}

	// Split on * and sequentially match each literal segment
	const segments = p.split('*');
	let pos = 0;
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (seg.length === 0) {
			continue;
		}
		const idx = c.indexOf(seg, pos);
		if (idx === -1) {
			return false;
		}
		pos = idx + seg.length;
	}

	// If pattern ends with *, the last segment must be a suffix match
	if (!p.endsWith('*') && pos !== c.length) {
		return false;
	}

	return true;
}

/**
 * Find the first model whose id, name, or family matches a glob pattern.
 * Matches against id first, then name, then family.
 */
function _matchGlobPattern(
	models: readonly vscode.LanguageModelChat[],
	pattern: string,
): vscode.LanguageModelChat | undefined {
	return (
		models.find(m => _matchesGlob(pattern, m.id)) ??
		models.find(m => _matchesGlob(pattern, m.name)) ??
		models.find(m => _matchesGlob(pattern, m.family)) ??
		undefined
	);
}

/** Fuzzy search within an already-fetched model list. */
function _findFuzzy(
	models: readonly vscode.LanguageModelChat[],
	search: string
): vscode.LanguageModelChat | undefined {
	const s = search.toLowerCase();
	return (
		models.find(m => m.id.toLowerCase() === s) ??
		models.find(m => m.name.toLowerCase() === s) ??
		models.find(m => m.family.toLowerCase().includes(s) || s.includes(m.family.toLowerCase())) ??
		undefined
	);
}
