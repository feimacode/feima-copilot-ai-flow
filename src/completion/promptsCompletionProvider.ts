/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import type { ILogService } from '../platform/log/common/logService';

/**
 * Provides completion items for `prompt:` fields inside *.flow.yaml / *.flow.yml YAML documents.
 *
 * Scans `.github/prompts/` and `.vscode/prompts/` directories for `.prompt.md` files and offers
 * completions with the prompt names (filename without `.prompt.md` extension).
 *
 * Example positions that trigger completions:
 *
 *   roles:
 *     - name: "Researcher"
 *       prompt: <cursor>
 *
 *   roles:
 *     - name: "Researcher"
 *       prompt:
 *         name: <cursor>
 *
 *   roles:
 *     - name: "Researcher"
 *       prompt:
 *         path: <cursor>
 */
export class PromptsCompletionProvider implements vscode.CompletionItemProvider {

	/** Document selector: all *.flow.yaml / *.flow.yml files */
	static readonly selector: vscode.DocumentSelector = [
		{ pattern: '**/*.flow.yaml' },
		{ pattern: '**/*.flow.yml' },
	];

	/** Characters that re-trigger the completion list */
	static readonly triggerCharacters = [':', ' '];

	/** Directories to scan for prompt files */
	private static readonly PROMPT_DIRS = ['.github/prompts', '.vscode/prompts'];

	/** Cached prompt names */
	private promptNames: string[] = [];

	/** Cached prompt file paths (for object syntax) */
	private promptPaths: string[] = [];

	/** File system watchers for prompt directories */
	private watchers: vscode.FileSystemWatcher[] = [];

	constructor(private readonly logService: ILogService) {
		this.setupWatchers();
	}

	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		_context: vscode.CompletionContext
	): Promise<vscode.CompletionItem[] | undefined> {

		this.logService.trace('[PromptsCompletion] provideCompletionItems called');
		this.logService.trace(`[PromptsCompletion] Document: ${document.fileName}`);
		this.logService.trace(`[PromptsCompletion] Position: ${position.line}:${position.character}`);

		// Only operate inside flow YAML files
		if (!this.isFlowFile(document)) {
			this.logService.trace('[PromptsCompletion] Not a flow file, returning undefined');
			return undefined;
		}

		// Only trigger on lines that look like a prompt field
		const fieldInfo = this.isPromptField(document, position);
		if (!fieldInfo) {
			this.logService.trace('[PromptsCompletion] Not a prompt field, returning undefined');
			return undefined;
		}

		this.logService.trace('[PromptsCompletion] Prompt field detected, scanning for prompts...');

		// Scan for prompts if cache is empty
		if (this.promptNames.length === 0) {
			await this.scanPrompts(token);
		}

		this.logService.trace(`[PromptsCompletion] Found ${this.promptNames.length} prompts: ${this.promptNames.join(', ')}`);

		if (this.promptNames.length === 0) {
			this.logService.trace('[PromptsCompletion] No prompts found, returning undefined');
			return undefined;
		}

		// Figure out what the user has already typed so we can replace it
		const lineText = document.lineAt(position).text;
		let typedPrefix = '';
		let replaceRange: vscode.Range;

		if (fieldInfo.type === 'inline') {
			// Inline syntax: prompt: <name>
			const fieldMatch = /^\s*prompt:\s*/.exec(lineText);
			if (fieldMatch) {
				// Start replacement after "prompt: " (including the space after colon)
				const replaceStart = fieldMatch[0].length;
				typedPrefix = lineText.substring(replaceStart, position.character);
				replaceRange = new vscode.Range(
					position.line, replaceStart,
					position.line, position.character
				);
			} else {
				return undefined;
			}
		} else if (fieldInfo.type === 'name') {
			// Object syntax: name: <value>
			const fieldMatch = /^\s*name:\s*/.exec(lineText);
			if (fieldMatch) {
				// Start replacement after "name: " (including the space after colon)
				const replaceStart = fieldMatch[0].length;
				typedPrefix = lineText.substring(replaceStart, position.character);
				replaceRange = new vscode.Range(
					position.line, replaceStart,
					position.line, position.character
				);
			} else {
				return undefined;
			}
		} else if (fieldInfo.type === 'path') {
			// Object syntax: path: <value>
			const fieldMatch = /^\s*path:\s*/.exec(lineText);
			if (fieldMatch) {
				// Start replacement after "path: " (including the space after colon)
				const replaceStart = fieldMatch[0].length;
				typedPrefix = lineText.substring(replaceStart, position.character);
				replaceRange = new vscode.Range(
					position.line, replaceStart,
					position.line, position.character
				);
			} else {
				return undefined;
			}
		} else {
			return undefined;
		}

		if (fieldInfo.type === 'inline' || fieldInfo.type === 'name') {
			return this.promptNames
				.filter(name => name.toLowerCase().startsWith(typedPrefix.toLowerCase()))
				.map(name => this.makeCompletionItem(name, typedPrefix, replaceRange));
		} else if (fieldInfo.type === 'path') {
			return this.promptPaths
				.filter(promptPath => promptPath.toLowerCase().startsWith(typedPrefix.toLowerCase()))
				.map(promptPath => this.makePathCompletionItem(promptPath, typedPrefix, replaceRange));
		}

		return undefined;
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Returns true if the document is a flow file.
	 */
	private isFlowFile(document: vscode.TextDocument): boolean {
		const filename = document.fileName;
		return filename.endsWith('.flow.yaml') || filename.endsWith('.flow.yml');
	}

	/**
	 * Returns field info when the cursor is on a `prompt:`, `prompt.name:`, or `prompt.path:` field line.
	 * Returns undefined if not a prompt field.
	 */
	private isPromptField(document: vscode.TextDocument, position: vscode.Position): { type: 'inline' | 'name' | 'path' } | undefined {
		const lineText = document.lineAt(position).text;

		// Check for inline prompt: <name>
		const inlineMatch = /^(\s*)prompt:\s*(.*)$/.exec(lineText);
		if (inlineMatch) {
			const colonIndex = lineText.indexOf(':');
			if (position.character > colonIndex) {
				// In YAML, objects use indentation, not braces
				// If there's content after the colon, treat as inline name
				return { type: 'inline' };
			}
		}

		// Check for object syntax: prompt:
		//   name: <value>
		const nameMatch = /^\s*name:\s*(.*)$/.exec(lineText);
		if (nameMatch) {
			// Check if this is inside a prompt block by looking at the parent key
			const colonIndex = lineText.indexOf(':');
			if (position.character > colonIndex) {
				// Walk upward to find if parent is prompt:
				for (let ln = position.line - 1; ln >= 0; ln--) {
					const parentLine = document.lineAt(ln).text.trim();
					if (parentLine.startsWith('prompt:')) {
						return { type: 'name' };
					}
					if (parentLine && !parentLine.startsWith('-') && !parentLine.startsWith('name:') && !parentLine.startsWith('path:')) {
						// Hit a different key, stop
						break;
					}
				}
			}
		}

		// Check for object syntax: prompt:
		//   path: <value>
		const pathMatch = /^\s*path:\s*(.*)$/.exec(lineText);
		if (pathMatch) {
			// Check if this is inside a prompt block by looking at the parent key
			const colonIndex = lineText.indexOf(':');
			if (position.character > colonIndex) {
				// Walk upward to find if parent is prompt:
				for (let ln = position.line - 1; ln >= 0; ln--) {
					const parentLine = document.lineAt(ln).text.trim();
					if (parentLine.startsWith('prompt:')) {
						return { type: 'path' };
					}
					if (parentLine && !parentLine.startsWith('-') && !parentLine.startsWith('name:') && !parentLine.startsWith('path:')) {
						// Hit a different key, stop
						break;
					}
				}
			}
		}

		return undefined;
	}

	/**
	 * Scans prompt directories for .prompt.md files and caches the names.
	 */
	private async scanPrompts(token: vscode.CancellationToken): Promise<void> {
		this.logService.trace('[PromptsCompletion] scanPrompts called');
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			this.logService.trace('[PromptsCompletion] No workspace folders found');
			return;
		}

		this.logService.trace(`[PromptsCompletion] Workspace folders: ${workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);

		const promptNames = new Set<string>();
		const promptPaths: string[] = [];

		for (const folder of workspaceFolders) {
			for (const promptDir of PromptsCompletionProvider.PROMPT_DIRS) {
				this.logService.trace(`[PromptsCompletion] Scanning directory: ${path.join(folder.uri.fsPath, promptDir)}`);

				try {
					const files = await vscode.workspace.findFiles(
						new vscode.RelativePattern(folder, `${promptDir}/**/*.prompt.md`),
						null,
						100,
						token
					);

					this.logService.trace(`[PromptsCompletion] Found ${files.length} prompt files in ${promptDir}`);

					for (const file of files) {
						const name = path.basename(file.fsPath, '.prompt.md');
						this.logService.trace(`[PromptsCompletion] Adding prompt: ${name} from ${file.fsPath}`);
						promptNames.add(name);
						// Store the full path for object syntax
						promptPaths.push(file.fsPath);
					}
				} catch (error) {
					this.logService.error(`[PromptsCompletion] Error scanning ${promptDir}: ${error}`);
					// Directory may not exist, ignore
				}
			}
		}

		this.promptNames = Array.from(promptNames).sort();
		this.promptPaths = promptPaths.sort();
		this.logService.trace(`[PromptsCompletion] Final prompt list: ${this.promptNames.join(', ')}`);
		this.logService.trace(`[PromptsCompletion] Final prompt paths: ${this.promptPaths.join(', ')}`);
	}

	/**
	 * Sets up file system watchers to refresh cache when prompt files change.
	 */
	private setupWatchers(): void {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		for (const folder of workspaceFolders) {
			for (const promptDir of PromptsCompletionProvider.PROMPT_DIRS) {
				const pattern = new vscode.RelativePattern(folder, `${promptDir}/**/*.prompt.md`);
				const watcher = vscode.workspace.createFileSystemWatcher(pattern);

				watcher.onDidCreate(() => this.refreshPrompts());
				watcher.onDidDelete(() => this.refreshPrompts());
				watcher.onDidChange(() => this.refreshPrompts());

				this.watchers.push(watcher);
			}
		}
	}

	/**
	 * Refreshes the prompt cache.
	 */
	private refreshPrompts(): void {
		this.promptNames = [];
		this.promptPaths = [];
	}

	/**
	 * Creates a CompletionItem for a prompt name (inline or name syntax).
	 */
	private makeCompletionItem(
		name: string,
		typedPrefix: string,
		range: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
		item.detail = 'Prompt';
		item.insertText = name;
		item.range = range;
		item.sortText = name.toLowerCase();
		return item;
	}

	/**
	 * Creates a CompletionItem for a prompt path (object syntax).
	 */
	private makePathCompletionItem(
		promptPath: string,
		typedPrefix: string,
		range: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(promptPath, vscode.CompletionItemKind.File);
		item.detail = 'Prompt File';
		item.insertText = promptPath;
		item.range = range;
		item.sortText = promptPath.toLowerCase();
		return item;
	}

	/**
	 * Disposes of file system watchers.
	 */
	dispose(): void {
		for (const watcher of this.watchers) {
			watcher.dispose();
		}
	}
}