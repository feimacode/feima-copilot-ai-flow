/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { ILogger } from '../platform/log/common/logService';

// ---------------------------------------------------------------------------
// Catalog index types — mirrors feima-harness-catalog/index.json schema
// ---------------------------------------------------------------------------

export interface ICatalogProvider {
	readonly name: string;
	readonly source: string;
	readonly trust: 'official' | 'community';
}

export interface ICatalogSkill {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: string;
	readonly tags: readonly string[];
	readonly type: 'skill';
	readonly provider: string;
	readonly used_in_flows: number;
}

export interface ICatalogPrompt {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: string;
	readonly tags: readonly string[];
	readonly type: 'prompt';
	readonly provider: string;
	readonly used_in_flows: number;
}

export interface ICatalogFlow {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: string;
	readonly tags: readonly string[];
	readonly category?: string;
	readonly orchestration: 'sequence' | 'staged' | 'fork-join';
	readonly roles: number;
	readonly type: 'flow';
	readonly provider: string;
	readonly uses_skills?: readonly string[];
	readonly uses_prompts?: readonly string[];
	/** Aggregate star count from GitHub gist/repo (optional, may be added by catalog action) */
	readonly stars?: number;
}

export interface ICatalogIndex {
	readonly version: number;
	readonly updated: string;
	readonly providers: readonly ICatalogProvider[];
	readonly skills: readonly ICatalogSkill[];
	readonly prompts: readonly ICatalogPrompt[];
	readonly flows: readonly ICatalogFlow[];
}

// ---------------------------------------------------------------------------
// CatalogClient — fetch, cache, and refresh the harness catalog index
// ---------------------------------------------------------------------------

const CATALOG_INDEX_URL = 'https://raw.githubusercontent.com/feimacode/feima-harness-catalog/main/index.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * Fetches and caches the harness catalog index.json.
 *
 * Three-tier fallback:
 *   1. Cached copy (globalStorageUri/catalog/index.json) — used if fresh
 *   2. Fresh fetch from GitHub raw URL — updates cache on success
 *   3. Bundled copy (assets/index.json) — offline fallback
 */
export class CatalogClient {
	private readonly bundledIndexPath: string;
	private readonly log: ILogger;

	constructor(
		private readonly context: vscode.ExtensionContext,
		log: ILogger,
	) {
		this.bundledIndexPath = path.join(context.extensionPath, 'assets', 'index.json');
		this.log = log.createSubLogger('CatalogClient');
	}

	/**
	 * Returns the catalog index, preferring cached → fresh → bundled.
	 * Set `forceRefresh` to skip the cache and always fetch from GitHub.
	 */
	async getIndex(forceRefresh: boolean = false): Promise<ICatalogIndex> {
		// 1. Try cached (if not forced refresh)
		if (!forceRefresh) {
			const cached = await this.tryLoadCached();
			if (cached && this.isCacheFresh(cached)) {
				this.log.info('Using cached catalog index');
				return cached;
			}
		}

		// 2. Try fetch from GitHub
		const fresh = await this.tryFetchRemote();
		if (fresh) {
			await this.cacheIndex(fresh);
			this.log.info('Using fresh catalog index from GitHub');
			return fresh;
		}

		// 3. Fall back to bundled
		this.log.warn('Falling back to bundled catalog index');
		return this.loadBundled();
	}

	/**
	 * Reads the cached index from global storage.
	 */
	private async tryLoadCached(): Promise<ICatalogIndex | undefined> {
		try {
			const cacheDir = vscode.Uri.joinPath(this.context.globalStorageUri, 'catalog');
			const cacheFile = vscode.Uri.joinPath(cacheDir, 'index.json');
			const bytes = await vscode.workspace.fs.readFile(cacheFile);
			const text = Buffer.from(bytes).toString('utf8');
			return JSON.parse(text) as ICatalogIndex;
		} catch {
			return undefined;
		}
	}

	/**
	 * Fetches the index from GitHub raw content URL.
	 */
	private async tryFetchRemote(): Promise<ICatalogIndex | undefined> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

			const response = await fetch(CATALOG_INDEX_URL, {
				signal: controller.signal,
				headers: { 'Accept': 'application/json' },
			});
			clearTimeout(timeout);

			if (!response.ok) {
				this.log.warn(`Catalog fetch failed: HTTP ${response.status}`);
				return undefined;
			}

			const text = await response.text();
			const index = JSON.parse(text) as ICatalogIndex;

			// Basic validation
			if (!index.version || !Array.isArray(index.flows)) {
				this.log.warn('Catalog index missing required fields');
				return undefined;
			}

			return index;
		} catch (err) {
			this.log.warn(`Catalog fetch error: ${err instanceof Error ? err.message : String(err)}`);
			return undefined;
		}
	}

	/**
	 * Reads the bundled index from the extension's assets/ directory.
	 */
	private async loadBundled(): Promise<ICatalogIndex> {
		try {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(this.bundledIndexPath));
			const text = Buffer.from(bytes).toString('utf8');
			return JSON.parse(text) as ICatalogIndex;
		} catch {
			this.log.warn('Bundled catalog index not found, returning empty index');
			return this.emptyIndex();
		}
	}

	/**
	 * Writes the index to global storage for caching.
	 */
	private async cacheIndex(index: ICatalogIndex): Promise<void> {
		try {
			const cacheDir = vscode.Uri.joinPath(this.context.globalStorageUri, 'catalog');
			await vscode.workspace.fs.createDirectory(cacheDir);
			const cacheFile = vscode.Uri.joinPath(cacheDir, 'index.json');
			const content = Buffer.from(JSON.stringify(index, null, '\t'), 'utf8');
			await vscode.workspace.fs.writeFile(cacheFile, content);
		} catch (err) {
			this.log.warn(`Failed to cache catalog index: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/**
	 * Checks whether the cached index is still within the TTL.
	 */
	private isCacheFresh(index: ICatalogIndex): boolean {
		try {
			const updated = new Date(index.updated).getTime();
			return (Date.now() - updated) < CACHE_TTL_MS;
		} catch {
			return false;
		}
	}

	/**
	 * Returns an empty index structure for graceful degradation.
	 */
	private emptyIndex(): ICatalogIndex {
		return {
			version: 1,
			updated: new Date(0).toISOString(),
			providers: [],
			skills: [],
			prompts: [],
			flows: [],
		};
	}
}
