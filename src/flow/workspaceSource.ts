/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFlowEntry } from './flowSource';

/**
 * WorkspaceSource provides flows installed in the user's workspace .github/flows/ directory.
 * These are production-ready flows that have been installed from the catalog.
 */
export class WorkspaceSource {
	private flows: IFlowEntry[] | undefined;
	private watcher: vscode.FileSystemWatcher | undefined;

	constructor() { }

	/**
	 * Get all workspace flow entries (cached after first scan).
	 */
	async getAll(): Promise<IFlowEntry[]> {
		if (this.flows) {
			return this.flows;
		}

		this.flows = await this.scan();
		return this.flows;
	}

	/**
	 * Find a workspace flow by id.
	 */
	async find(id: string): Promise<IFlowEntry | undefined> {
		const all = await this.getAll();
		return all.find(f => f.id === id);
	}

	/**
	 * Search workspace flows by query (matches name, description, tags).
	 */
	async search(query: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		const q = query.toLowerCase();
		return all.filter(f =>
			f.name.toLowerCase().includes(q) ||
			f.description?.toLowerCase().includes(q) ||
			f.tags?.some(t => t.toLowerCase().includes(q))
		);
	}

	/**
	 * Force re-scan of the workspace .github/flows/ directory.
	 */
	async refresh(): Promise<IFlowEntry[]> {
		this.flows = undefined;
		return this.getAll();
	}

	/**
	 * Watch for changes to .github/flows/ directory.
	 */
	watch(onChange: () => void): vscode.Disposable {
		if (this.watcher) {
			return this.watcher;
		}

		const pattern = new vscode.RelativePattern(
			vscode.workspace.workspaceFolders?.[0] || vscode.Uri.file('/'),
			'.github/flows/*.flow.yaml'
		);

		this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

		this.watcher.onDidCreate(() => {
			this.flows = undefined;
			onChange();
		});

		this.watcher.onDidDelete(() => {
			this.flows = undefined;
			onChange();
		});

		this.watcher.onDidChange(() => {
			this.flows = undefined;
			onChange();
		});

		return this.watcher;
	}

	dispose(): void {
		this.watcher?.dispose();
	}

	private async scan(): Promise<IFlowEntry[]> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return [];
		}

		const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		const results: IFlowEntry[] = [];

		try {
			const entries = await vscode.workspace.fs.readDirectory(flowsDir);
			for (const [name, type] of entries) {
				if (type !== vscode.FileType.File || !name.endsWith('.flow.yaml')) {
					continue;
				}

				const filePath = vscode.Uri.joinPath(flowsDir, name);
				const id = name.replace(/\.flow\.yaml$/, '');

				// Parse basic metadata from the file
				const metadata = await this.parseMetadata(filePath);

				results.push({
					id,
					name: metadata.name || id,
					description: metadata.description,
					tags: metadata.tags,
					category: metadata.category,
					difficulty: metadata.difficulty,
					version: metadata.version,
					author: metadata.author,
					source: 'workspace',
					filePath: filePath.fsPath,
				});
			}
		} catch (error) {
			// Directory doesn't exist or can't be read - this is normal
			if ((error as vscode.FileSystemError)?.code !== 'FileNotFound') {
				console.warn('WorkspaceSource: Failed to scan .github/flows directory:', error);
			}
		}

		return results;
	}

	private async parseMetadata(uri: vscode.Uri): Promise<{
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
			const lines = text.split('\n');

			let name: string | undefined;
			let description: string | undefined;
			let tags: string[] | undefined;
			let category: string | undefined;
			let difficulty: 'beginner' | 'intermediate' | 'advanced' | undefined;
			let version: string | undefined;
			let author: string | undefined;

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith('name:')) {
					name = this.parseYamlString(trimmed.substring(5));
				} else if (trimmed.startsWith('description:')) {
					description = this.parseYamlString(trimmed.substring(12));
				} else if (trimmed.startsWith('category:')) {
					category = this.parseYamlString(trimmed.substring(9));
				} else if (trimmed.startsWith('difficulty:')) {
					const val = this.parseYamlString(trimmed.substring(11));
					if (val === 'beginner' || val === 'intermediate' || val === 'advanced') {
						difficulty = val;
					}
				} else if (trimmed.startsWith('version:')) {
					version = this.parseYamlString(trimmed.substring(8));
				} else if (trimmed.startsWith('author:')) {
					author = this.parseYamlString(trimmed.substring(7));
				} else if (trimmed.startsWith('tags:')) {
					tags = this.parseYamlArray(trimmed.substring(5), lines, lines.indexOf(line));
				}
			}

			return { name, description, tags, category, difficulty, version, author };
		} catch {
			return {};
		}
	}

	private parseYamlString(value: string): string | undefined {
		const trimmed = value.trim();
		if (!trimmed || trimmed === '""' || trimmed === "''") {
			return undefined;
		}
		// Remove surrounding quotes
		if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))) {
			return trimmed.slice(1, -1);
		}
		return trimmed;
	}

	private parseYamlArray(inlineValue: string, lines: string[], currentIndex: number): string[] | undefined {
		const trimmed = inlineValue.trim();

		// Inline array: [tag1, tag2, tag3]
		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			return trimmed.slice(1, -1)
				.split(',')
				.map(s => this.parseYamlString(s.trim()) || '')
				.filter(Boolean);
		}

		// Multi-line array (items on subsequent lines starting with -)
		if (trimmed === '' || trimmed === '|' || trimmed === '>') {
			const items: string[] = [];
			for (let i = currentIndex + 1; i < lines.length; i++) {
				const nextLine = lines[i].trim();
				if (nextLine.startsWith('- ')) {
					const item = this.parseYamlString(nextLine.substring(2));
					if (item) {
						items.push(item);
					}
				} else if (nextLine && !nextLine.startsWith('#')) {
					break;
				}
			}
			return items.length > 0 ? items : undefined;
		}

		return undefined;
	}
}
