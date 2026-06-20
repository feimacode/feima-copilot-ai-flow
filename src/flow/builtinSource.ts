/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IFlowEntry } from './flowSource';

/**
 * BuiltinSource provides flows bundled with the extension in the examples/ directory.
 * These are pedagogical examples meant for playground use, not production.
 */
export class BuiltinSource {
	private flows: IFlowEntry[] | undefined;

	constructor(private readonly extensionUri: vscode.Uri) { }

	/**
	 * Get all builtin flow entries (cached after first scan).
	 */
	async getAll(): Promise<IFlowEntry[]> {
		if (this.flows) {
			return this.flows;
		}

		this.flows = await this.scan();
		return this.flows;
	}

	/**
	 * Find a builtin flow by id.
	 */
	async find(id: string): Promise<IFlowEntry | undefined> {
		const all = await this.getAll();
		return all.find(f => f.id === id);
	}

	/**
	 * Search builtin flows by query (matches name, description, tags).
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
	 * Force re-scan of the examples/ directory.
	 */
	async refresh(): Promise<IFlowEntry[]> {
		this.flows = undefined;
		return this.getAll();
	}

	private async scan(): Promise<IFlowEntry[]> {
		const examplesDir = vscode.Uri.joinPath(this.extensionUri, 'examples');
		const results: IFlowEntry[] = [];

		try {
			const entries = await vscode.workspace.fs.readDirectory(examplesDir);
			for (const [name, type] of entries) {
				if (type !== vscode.FileType.File || !name.endsWith('.flow.yaml')) {
					continue;
				}

				const filePath = vscode.Uri.joinPath(examplesDir, name);
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
					source: 'builtin',
					filePath: filePath.fsPath,
				});
			}
		} catch (error) {
			console.warn('BuiltinSource: Failed to scan examples directory:', error);
		}

		return results;
	}

	private async parseMetadata(uri: vscode.Uri): Promise<{
		name?: string;
		description?: string;
		tags?: readonly string[];
		category?: string;
		difficulty?: 'beginner' | 'intermediate' | 'advanced';
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
				} else if (trimmed.startsWith('tags:')) {
					tags = this.parseYamlArray(trimmed.substring(5), lines, lines.indexOf(line));
				}
			}

			return { name, description, tags, category, difficulty };
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
