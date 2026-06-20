/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect } from 'vitest';
import { FlowLibrary } from './flowLibrary';
import { IFlowEntry } from './flowSource';
import * as vscode from 'vscode';

/**
 * Integration tests for FlowLibrary source merging and precedence logic.
 */

describe('FlowLibrary source merging', () => {
	// Minimal mock context for the constructor
	const mockContext = {
		// FlowLibrary constructor doesn't use context directly in tests
	} as unknown as vscode.ExtensionContext;

	// Minimal mock catalog client
	const mockCatalogClient = {
		getIndex: async () => ({ version: 1, updated: '', providers: [], skills: [], prompts: [], flows: [] })
	} as unknown as import('./catalogClient').CatalogClient;

	function createLibrary(): FlowLibrary {
		return new FlowLibrary(mockContext, mockCatalogClient);
	}

	function makeEntry(id: string, source: 'builtin' | 'catalog' | 'workspace', overrides: Partial<IFlowEntry> = {}): IFlowEntry {
		return {
			id,
			name: `${source}-${id}`,
			source,
			...overrides,
		};
	}

	it('returns all flows when no ids overlap', () => {
		const lib = createLibrary();
		const builtin = [makeEntry('a', 'builtin')];
		const catalog = [makeEntry('b', 'catalog')];
		const workspace = [makeEntry('c', 'workspace')];

		const result = lib.mergeWithPrecedence(builtin, catalog, workspace);

		expect(result).toHaveLength(3);
		expect(result.map(f => f.id)).toContain('a');
		expect(result.map(f => f.id)).toContain('b');
		expect(result.map(f => f.id)).toContain('c');
	});

	it('workspace overrides catalog for same id', () => {
		const lib = createLibrary();
		const builtin = [makeEntry('shared', 'builtin', { name: 'builtin-name' })];
		const catalog = [makeEntry('shared', 'catalog', { name: 'catalog-name' })];
		const workspace = [makeEntry('shared', 'workspace', { name: 'workspace-name' })];

		const result = lib.mergeWithPrecedence(builtin, catalog, workspace);

		expect(result).toHaveLength(1);
		expect(result[0].source).toBe('workspace');
		expect(result[0].name).toBe('workspace-name');
	});

	it('catalog overrides builtin for same id', () => {
		const lib = createLibrary();
		const builtin = [makeEntry('shared', 'builtin', { name: 'builtin-name' })];
		const catalog = [makeEntry('shared', 'catalog', { name: 'catalog-name' })];
		const workspace: IFlowEntry[] = [];

		const result = lib.mergeWithPrecedence(builtin, catalog, workspace);

		expect(result).toHaveLength(1);
		expect(result[0].source).toBe('catalog');
		expect(result[0].name).toBe('catalog-name');
	});

	it('workspace overrides builtin for same id when no catalog entry', () => {
		const lib = createLibrary();
		const builtin = [makeEntry('shared', 'builtin', { name: 'builtin-name' })];
		const catalog: IFlowEntry[] = [];
		const workspace = [makeEntry('shared', 'workspace', { name: 'workspace-name' })];

		const result = lib.mergeWithPrecedence(builtin, catalog, workspace);

		expect(result).toHaveLength(1);
		expect(result[0].source).toBe('workspace');
		expect(result[0].name).toBe('workspace-name');
	});

	it('sorts merged results by name', () => {
		const lib = createLibrary();
		const builtin = [makeEntry('z', 'builtin', { name: 'zebra' })];
		const catalog = [makeEntry('a', 'catalog', { name: 'apple' })];
		const workspace = [makeEntry('m', 'workspace', { name: 'mango' })];

		const result = lib.mergeWithPrecedence(builtin, catalog, workspace);

		expect(result.map(f => f.name)).toEqual(['apple', 'mango', 'zebra']);
	});

	it('handles empty sources', () => {
		const lib = createLibrary();
		const result = lib.mergeWithPrecedence([], [], []);
		expect(result).toHaveLength(0);
	});

	it('preserves catalog metadata after merge', () => {
		const lib = createLibrary();
		const catalog = [makeEntry('flow1', 'catalog', {
			name: 'Flow One',
			provider: 'feima-awesome-harness',
			trust: 'official',
			orchestration: 'sequence',
			roleCount: 3,
		})];

		const result = lib.mergeWithPrecedence([], catalog, []);

		expect(result[0].provider).toBe('feima-awesome-harness');
		expect(result[0].trust).toBe('official');
		expect(result[0].orchestration).toBe('sequence');
		expect(result[0].roleCount).toBe(3);
	});
});
