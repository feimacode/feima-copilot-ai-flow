/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { IFlowMetadata } from '../types/flowDocument';

export interface IFlowEntry extends IFlowMetadata {
	/** Slug derived from the filename (e.g. `sdd-spec-kit`). */
	readonly id: string;
	/** Absolute path to the `.flow.yaml` file. */
	readonly filePath: string;
	/** Where the flow comes from. */
	readonly source: 'builtin';
}

/**
 * Scans the extension's built-in `examples/` directory for `*.flow.yaml` files,
 * reads their YAML front-matter metadata, and exposes search / install helpers
 * for the `@flow` chat participant slash commands.
 */
export class FlowLibrary {
	/** Simple in-process cache so we don't stat/read on every keystroke. */
	private _cache: IFlowEntry[] | undefined;

	constructor(private readonly context: vscode.ExtensionContext) {}

	/** Returns all built-in flows (cached after the first call). */
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
			f.id.toLowerCase().includes(q)
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
	 * Copies a flow file into `targetFolder` and returns the destination URI.
	 * Throws if `targetFolder` is not writable or if the file already exists and
	 * the user chose not to overwrite.
	 */
	async install(entry: IFlowEntry, targetFolder: vscode.Uri): Promise<vscode.Uri> {
		const fileName = path.basename(entry.filePath);
		const dest = vscode.Uri.joinPath(targetFolder, fileName);
		await vscode.workspace.fs.copy(
			vscode.Uri.file(entry.filePath),
			dest,
			{ overwrite: false }
		);
		return dest;
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	private async _scan(): Promise<IFlowEntry[]> {
		const promptsRoot = path.join(this.context.extensionPath, 'examples');
		const rootUri = vscode.Uri.file(promptsRoot);

		let entries: IFlowEntry[] = [];
		try {
			entries = await this._scanDir(rootUri);
		} catch {
			// examples/ directory may not exist in some builds; return empty list
		}
		return entries.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async _scanDir(dirUri: vscode.Uri): Promise<IFlowEntry[]> {
		const results: IFlowEntry[] = [];
		const children = await vscode.workspace.fs.readDirectory(dirUri);

		for (const [name, type] of children) {
			const childUri = vscode.Uri.joinPath(dirUri, name);
			if (type === vscode.FileType.Directory) {
				const sub = await this._scanDir(childUri);
				results.push(...sub);
			} else if (
				type === vscode.FileType.File &&
				(name.endsWith('.flow.yaml') || name.endsWith('.flow.yml'))
			) {
				const entry = await this._readEntry(childUri);
				if (entry) {
					results.push(entry);
				}
			}
		}
		return results;
	}

	private async _readEntry(fileUri: vscode.Uri): Promise<IFlowEntry | undefined> {
		try {
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(bytes).toString('utf8');
			const doc = yaml.load(text) as Partial<IFlowMetadata> | null;
			if (!doc || typeof doc !== 'object') {
				return undefined;
			}

			const filePath = fileUri.fsPath;
			const basename = path.basename(filePath);
			// Strip .flow.yaml / .flow.yml suffix to get the id
			const id = basename.replace(/\.flow\.ya?ml$/, '');
			const name = doc.name ?? id;

			return {
				id,
				name,
				filePath,
				source: 'builtin',
				description: doc.description,
				category: doc.category,
				subcategory: doc.subcategory,
				tags: doc.tags,
				difficulty: doc.difficulty,
				version: doc.version,
				author: doc.author,
			};
		} catch {
			return undefined;
		}
	}
}
