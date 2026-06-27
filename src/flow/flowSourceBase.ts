/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { IFlowEntry } from './flowSource';

/**
 * Abstract base for flow sources (builtin, workspace, catalog).
 *
 * Provides shared caching, search, lookup, and YAML metadata helpers.
 * Subclasses only need to implement `load()`.
 */
export abstract class FlowSourceBase {
	protected entries: IFlowEntry[] | undefined;

	/** Subclasses implement this to populate `entries` from their data source. */
	protected abstract load(): Promise<IFlowEntry[]>;

	/** All flow entries (cached after first call). */
	async getAll(): Promise<IFlowEntry[]> {
		if (!this.entries) {
			this.entries = await this.load();
		}
		return this.entries;
	}

	/** Find a flow by exact id match. */
	async find(id: string): Promise<IFlowEntry | undefined> {
		const all = await this.getAll();
		return all.find(f => f.id === id);
	}

	/**
	 * Fuzzy search by name, description, tags, category, subcategory, provider.
	 * Subclasses can override to add source-specific fields.
	 */
	async search(query: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		const q = query.toLowerCase().trim();
		if (!q) { return all; }
		return all.filter(f =>
			f.name.toLowerCase().includes(q) ||
			f.description?.toLowerCase().includes(q) ||
			f.category?.toLowerCase().includes(q) ||
			f.subcategory?.toLowerCase().includes(q) ||
			f.tags?.some(t => t.toLowerCase().includes(q)) ||
			f.id.toLowerCase().includes(q) ||
			f.provider?.toLowerCase().includes(q)
		);
	}

	/** Invalidate cache so the next `getAll()` re-runs `load()`. */
	async refresh(): Promise<IFlowEntry[]> {
		this.entries = undefined;
		return this.getAll();
	}

	// ------------------------------------------------------------------
	// Shared YAML metadata helpers (used by file-based sources)
	// ------------------------------------------------------------------

	/** Parse name / description / tags / category / difficulty from a
	 *  .flow.yaml file using js-yaml. */
	protected static async parseMetadata(uri: vscode.Uri): Promise<{
		name?: string;
		description?: string;
		tags?: readonly string[];
		category?: string;
		difficulty?: 'beginner' | 'intermediate' | 'advanced';
		version?: string;
		author?: string;
	}> {
		try {
			const content = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder().decode(content);
			const doc = yaml.load(text) as Record<string, unknown> | undefined;
			if (!doc || typeof doc !== 'object') { return {}; }

			const difficulty = FlowSourceBase.coerceDifficulty(doc.difficulty);
			const tags: string[] | undefined = Array.isArray(doc.tags)
				? (doc.tags as unknown[]).map(String)
				: undefined;

			return {
				name: doc.name ? String(doc.name) : undefined,
				description: doc.description ? String(doc.description) : undefined,
				tags,
				category: doc.category ? String(doc.category) : undefined,
				difficulty,
				version: doc.version ? String(doc.version) : undefined,
				author: doc.author ? String(doc.author) : undefined,
			};
		} catch {
			return {};
		}
	}

	private static coerceDifficulty(value: unknown): 'beginner' | 'intermediate' | 'advanced' | undefined {
		const s = value != null ? String(value).toLowerCase() : '';
		if (s === 'beginner' || s === 'intermediate' || s === 'advanced') { return s; }
		return undefined;
	}

	/**
	 * Helper: build a flow entry from parsed metadata for file-based sources.
	 */
	protected static entryFromMetadata(
		id: string,
		metadata: {
			name?: string;
			description?: string;
			tags?: readonly string[];
			category?: string;
			difficulty?: 'beginner' | 'intermediate' | 'advanced';
			version?: string;
			author?: string;
		},
		source: 'builtin' | 'workspace',
		filePath: string,
	): IFlowEntry {
		return {
			id,
			name: metadata.name || id,
			description: metadata.description,
			tags: metadata.tags,
			category: metadata.category,
			difficulty: metadata.difficulty,
			version: metadata.version,
			author: metadata.author,
			source,
			filePath,
		};
	}
}
