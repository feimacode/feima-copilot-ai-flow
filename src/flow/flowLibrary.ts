/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IFlowEntry } from './flowSource';
import { BuiltinSource } from './builtinSource';
import { CatalogSource } from './catalogSource';
import { WorkspaceSource } from './workspaceSource';
import { CatalogClient } from './catalogClient';
import { fetchFlow } from './sourceUriResolver';

/**
 * Scans flows from three sources (builtin, catalog, workspace),
 * reads their YAML front-matter metadata, and exposes search / install helpers
 * for the `@flow` chat participant slash commands.
 *
 * Precedence: workspace > catalog > builtin
 */
export class FlowLibrary {
	/** Simple in-process cache so we don't stat/read on every keystroke. */
	private _cache: IFlowEntry[] | undefined;

	private readonly _builtinSource: BuiltinSource;
	private readonly _catalogSource: CatalogSource;
	private readonly _workspaceSource: WorkspaceSource;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly catalogClient: CatalogClient
	) {
		this._builtinSource = new BuiltinSource(context.extensionUri);
		this._catalogSource = new CatalogSource(catalogClient);
		this._workspaceSource = new WorkspaceSource();
	}

	/** Returns all flows from all sources (cached after the first call). */
	async getAll(): Promise<IFlowEntry[]> {
		if (this._cache) {
			return this._cache;
		}
		this._cache = await this._scan();
		return this._cache;
	}

	/** Filters flows whose name / description / tags / category match the query. */
	async search(query: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		const q = query.toLowerCase().trim();
		if (!q) {
			return all;
		}
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

	/**
	 * Finds a flow by its id or display name (case-insensitive).
	 * Returns `undefined` when not found.
	 */
	async find(nameOrId: string): Promise<IFlowEntry | undefined> {
		const all = await this.getAll();
		const q = nameOrId.toLowerCase().trim();
		return (
			all.find(f => f.id === q) ??
			all.find(f => f.name.toLowerCase() === q) ??
			all.find(f => f.id.includes(q) || f.name.toLowerCase().includes(q))
		);
	}

	/**
	 * Installs a flow into the target folder.
	 *
	 * For builtin and workspace flows: copies the file from the local path.
	 * For catalog flows: fetches the YAML from the source URI.
	 *
	 * Handles duplicate detection, overwrite confirmation, and directory creation.
	 *
	 * @returns The destination URI and companion info (if any)
	 */
	async install(entry: IFlowEntry, targetFolder: vscode.Uri): Promise<{
		dest: vscode.Uri;
		companions?: { skills: readonly string[]; prompts: readonly string[] };
	}> {
		const destFileName = `${entry.id}.flow.yaml`;
		const dest = vscode.Uri.joinPath(targetFolder, destFileName);

		// Create target directory if it doesn't exist
		try {
			await vscode.workspace.fs.createDirectory(targetFolder);
		} catch {
			// Directory may already exist — that's fine
		}

		// Check for duplicate
		try {
			await vscode.workspace.fs.stat(dest);
			// File exists — ask for overwrite confirmation
			const overwrite = await vscode.window.showWarningMessage(
				`Flow "${entry.name}" already exists in .github/flows/. Overwrite?`,
				{ modal: true },
				'Overwrite'
			);
			if (overwrite !== 'Overwrite') {
				throw new Error(`Installation cancelled: "${entry.name}" already exists.`);
			}
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
				// File doesn't exist — proceed
			} else if (error instanceof Error && error.message.includes('Installation cancelled')) {
				throw error;
			}
		}

		// Install based on source type
		if (entry.source === 'catalog' && entry.sourceUri) {
			// Fetch from remote source
			const result = await fetchFlow(entry.sourceUri);
			const content = new TextEncoder().encode(result.content);
			await vscode.workspace.fs.writeFile(dest, content);
		} else if (entry.filePath) {
			// Copy from local file
			await vscode.workspace.fs.copy(
				vscode.Uri.file(entry.filePath),
				dest,
				{ overwrite: true }
			);
		} else {
			throw new Error(`Flow entry "${entry.id}" has no file path or source URI`);
		}

		// Build companion info
		const companions = (entry.usesSkills || entry.usesPrompts) ? {
			skills: entry.usesSkills || [],
			prompts: entry.usesPrompts || [],
		} : undefined;

		return { dest, companions };
	}

	/**
	 * Refresh all sources (clears caches and re-scans).
	 */
	async refresh(forceFetch: boolean = false): Promise<IFlowEntry[]> {
		this._cache = undefined;
		await this._builtinSource.refresh();
		await this._catalogSource.refresh(forceFetch);
		await this._workspaceSource.refresh();
		return this.getAll();
	}

	/**
	 * Get the builtin source for direct access.
	 */
	getBuiltinSource(): BuiltinSource {
		return this._builtinSource;
	}

	/**
	 * Get the catalog source for direct access.
	 */
	getCatalogSource(): CatalogSource {
		return this._catalogSource;
	}

	/**
	 * Get the workspace source for direct access.
	 */
	getWorkspaceSource(): WorkspaceSource {
		return this._workspaceSource;
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	private async _scan(): Promise<IFlowEntry[]> {
		const builtin = await this._builtinSource.getAll();
		const catalog = await this._catalogSource.getAll();
		const workspace = await this._workspaceSource.getAll();

		return this.mergeWithPrecedence(builtin, catalog, workspace);
	}

	/**
	 * Merge flows from all sources with precedence.
	 * Workspace flows override catalog flows, which override builtin flows.
	 */
	mergeWithPrecedence(
		builtin: IFlowEntry[],
		catalog: IFlowEntry[],
		workspace: IFlowEntry[]
	): IFlowEntry[] {
		const map = new Map<string, IFlowEntry>();

		// Add builtin flows first (lowest precedence)
		for (const flow of builtin) {
			map.set(flow.id, flow);
		}

		// Override with catalog flows
		for (const flow of catalog) {
			map.set(flow.id, flow);
		}

		// Override with workspace flows (highest precedence)
		for (const flow of workspace) {
			map.set(flow.id, flow);
		}

		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}
}
