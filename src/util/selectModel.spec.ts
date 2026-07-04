/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { parseModelOverride } from '../util/selectModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(id: string, vendor: string, family: string, name?: string): vscode.LanguageModelChat {
	return {
		id,
		vendor,
		family,
		name: name ?? id,
		version: '1.0',
		maxInputTokens: 4096,
		sendRequest: async () => ({ text: async function* () { yield ''; } } as unknown as vscode.LanguageModelChatResponse),
		countTokens: async () => 0,
	} as unknown as vscode.LanguageModelChat;
}

// ---------------------------------------------------------------------------
// parseModelOverride
// ---------------------------------------------------------------------------

describe('parseModelOverride', () => {
	it('returns null for empty / whitespace strings', () => {
		expect(parseModelOverride('')).toBeNull();
		expect(parseModelOverride('   ')).toBeNull();
		expect(parseModelOverride('\t')).toBeNull();
	});

	it('parses bare model id (no dot) as modelPattern only', () => {
		const r = parseModelOverride('gpt-4o');
		expect(r).toEqual({ modelPattern: 'gpt-4o' });
	});

	it('parses vendor.model on first dot', () => {
		const r = parseModelOverride('copilot.gpt-4o');
		expect(r).toEqual({ vendor: 'copilot', modelPattern: 'gpt-4o' });
	});

	it('handles wildcard modelPattern', () => {
		const r = parseModelOverride('copilot.*');
		expect(r).toEqual({ vendor: 'copilot', modelPattern: '*' });
	});

	it('handles bare wildcard', () => {
		const r = parseModelOverride('*');
		expect(r).toEqual({ modelPattern: '*' });
	});

	it('handles bare glob pattern', () => {
		const r = parseModelOverride('gpt-*');
		expect(r).toEqual({ modelPattern: 'gpt-*' });
	});

	it('treats leading dot as bare modelPattern', () => {
		// ".gpt-4o" — vendor is empty after split, so falls back to bare
		const r = parseModelOverride('.gpt-4o');
		expect(r).toEqual({ modelPattern: '.gpt-4o' });
	});

	it('treats trailing dot as bare modelPattern', () => {
		// "copilot." — modelPattern is empty after split
		const r = parseModelOverride('copilot.');
		expect(r).toEqual({ modelPattern: 'copilot.' });
	});
});

// ---------------------------------------------------------------------------
// _isGlob (indirectly tested via selectModel; unit tests on glob logic)
// ---------------------------------------------------------------------------

describe('glob matching (unit)', () => {
	// Recreate the internal glob logic for direct testing since _matchesGlob is not exported
	function matchesGlob(pattern: string, candidate: string): boolean {
		const p = pattern.toLowerCase();
		const c = candidate.toLowerCase();

		if (p === '*') {
			return true;
		}

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

		if (!p.endsWith('*') && pos !== c.length) {
			return false;
		}

		return true;
	}

	it('* matches everything', () => {
		expect(matchesGlob('*', 'anything')).toBe(true);
		expect(matchesGlob('*', '')).toBe(true);
	});

	it('literal match', () => {
		expect(matchesGlob('gpt-4o', 'gpt-4o')).toBe(true);
		expect(matchesGlob('gpt-4o', 'gpt-4')).toBe(false);
	});

	it('prefix glob gpt-*', () => {
		expect(matchesGlob('gpt-*', 'gpt-4o')).toBe(true);
		expect(matchesGlob('gpt-*', 'gpt-4')).toBe(true);
		expect(matchesGlob('gpt-*', 'claude-4')).toBe(false);
	});

	it('suffix glob *-4o', () => {
		expect(matchesGlob('*-4o', 'gpt-4o')).toBe(true);
		expect(matchesGlob('*-4o', 'claude-4o')).toBe(true);
		expect(matchesGlob('*-4o', 'gpt-4')).toBe(false);
	});

	it('middle glob claude-*-5', () => {
		expect(matchesGlob('claude-*-5', 'claude-sonnet-5')).toBe(true);
		expect(matchesGlob('claude-*-5', 'claude-5')).toBe(false);
	});

	it('multiple stars claude-*sonnet*', () => {
		expect(matchesGlob('claude-*sonnet*', 'claude-sonnet-4.5')).toBe(true);
		expect(matchesGlob('claude-*sonnet*', 'claude-haiku-2025')).toBe(false);
	});

	it('case insensitive', () => {
		expect(matchesGlob('GPT-4O', 'gpt-4o')).toBe(true);
		expect(matchesGlob('COPILOT.*', 'copilot.gpt-4o')).toBe(true);
	});

	it('exact glob with no star must match full string', () => {
		expect(matchesGlob('gpt', 'gpt-4o')).toBe(false);
		expect(matchesGlob('gpt', 'gpt')).toBe(true);
	});
});
