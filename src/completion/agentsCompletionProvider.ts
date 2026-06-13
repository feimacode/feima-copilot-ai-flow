/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import type { ILogService } from '../platform/log/common/logService';

/**
 * Provides completion items for `agent:` fields inside *.flow.yaml / *.flow.yml YAML documents.
 *
 * Scans `.github/agents/` and `.agents/` directories for `.agent.md` files and offers
 * completions with the agent names (filename without `.agent.md` extension).
 *
 * Example positions that trigger completions:
 *
 *   roles:
 *     - name: "Researcher"
 *       agent: <cursor>
 *
 *   roles:
 *     - name: "Researcher"
 *       agent:
 *         path: <cursor>
 */
export class AgentsCompletionProvider implements vscode.CompletionItemProvider {

	/** Document selector: all *.flow.yaml / *.flow.yml files */
	static readonly selector: vscode.DocumentSelector = [
		{ pattern: '**/*.flow.yaml' },
		{ pattern: '**/*.flow.yml' },
	];

	/** Characters that re-trigger the completion list */
	static readonly triggerCharacters = [':', ' '];

	/** Directories to scan for agent files */
	private static readonly AGENT_DIRS = ['.github/agents', '.agents'];

	/** Cached agent names */
	private agentNames: string[] = [];

	/** Cached agent file paths (for object syntax) */
	private agentPaths: string[] = [];

	/** File system watchers for agent directories */
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

		this.logService.trace('[AgentsCompletion] provideCompletionItems called');
		this.logService.trace(`[AgentsCompletion] Document: ${document.fileName}`);
		this.logService.trace(`[AgentsCompletion] Position: ${position.line}:${position.character}`);

		// Only operate inside flow YAML files
		if (!this.isFlowFile(document)) {
			this.logService.trace('[AgentsCompletion] Not a flow file, returning undefined');
			return undefined;
		}

		// Only trigger on lines that look like an agent field
		const fieldInfo = this.isAgentField(document, position);
		if (!fieldInfo) {
			this.logService.trace('[AgentsCompletion] Not an agent field, returning undefined');
			return undefined;
		}

		this.logService.trace('[AgentsCompletion] Agent field detected, scanning for agents...');

		// Scan for agents if cache is empty
		if (this.agentNames.length === 0) {
			await this.scanAgents(token);
		}

		this.logService.trace(`[AgentsCompletion] Found ${this.agentNames.length} agents: ${this.agentNames.join(', ')}`);

		if (this.agentNames.length === 0) {
			this.logService.trace('[AgentsCompletion] No agents found, returning undefined');
			return undefined;
		}

		// Figure out what the user has already typed so we can replace it
		const lineText = document.lineAt(position).text;
		let typedPrefix = '';
		let replaceRange: vscode.Range;

		if (fieldInfo.type === 'inline') {
			// Inline syntax: agent: <name>
			const fieldMatch = /^\s*agent:\s*/.exec(lineText);
			if (!fieldMatch) {
				return undefined;
			}
			const replaceStart = fieldMatch[0].length;
			typedPrefix = lineText.substring(replaceStart, position.character);
			replaceRange = new vscode.Range(
				position.line, replaceStart,
				position.line, position.character
			);

			return this.agentNames
				.filter(name => name.toLowerCase().startsWith(typedPrefix.toLowerCase()))
				.map(name => this.makeCompletionItem(name, typedPrefix, replaceRange));
		} else if (fieldInfo.type === 'path') {
			// Object syntax: agent:
			//   path: <value>
			const fieldMatch = /^\s*path:\s*/.exec(lineText);
			if (!fieldMatch) {
				return undefined;
			}
			const replaceStart = fieldMatch[0].length;
			typedPrefix = lineText.substring(replaceStart, position.character);
			replaceRange = new vscode.Range(
				position.line, replaceStart,
				position.line, position.character
			);

			return this.agentPaths
				.filter(agentPath => agentPath.toLowerCase().startsWith(typedPrefix.toLowerCase()))
				.map(agentPath => this.makePathCompletionItem(agentPath, typedPrefix, replaceRange));
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
	 * Returns field info when the cursor is on an `agent:` or `agent.path:` field line.
	 * Returns undefined if not an agent field.
	 */
	private isAgentField(document: vscode.TextDocument, position: vscode.Position): { type: 'inline' | 'path' } | undefined {
		const lineText = document.lineAt(position).text;

		// Check for inline agent: <name>
		const inlineMatch = /^(\s*)agent:\s*(.*)$/.exec(lineText);
		if (inlineMatch) {
			const colonIndex = lineText.indexOf(':');
			if (position.character > colonIndex) {
				// In YAML, objects use indentation, not braces
				// If there's content after the colon, treat as inline name
				return { type: 'inline' };
			}
		}

		// Check for object syntax: agent:
		//   path: <value>
		const pathMatch = /^\s*path:\s*(.*)$/.exec(lineText);
		if (pathMatch) {
			// Check if this is inside an agent block by looking at the parent key
			const colonIndex = lineText.indexOf(':');
			if (position.character > colonIndex) {
				// Walk upward to find if parent is agent:
				for (let ln = position.line - 1; ln >= 0; ln--) {
					const parentLine = document.lineAt(ln).text.trim();
					if (parentLine.startsWith('agent:')) {
						return { type: 'path' };
					}
					if (parentLine && !parentLine.startsWith('-') && !parentLine.startsWith('path:')) {
						// Hit a different key, stop
						break;
					}
				}
			}
		}

		return undefined;
	}

	/**
	 * Scans agent directories for .agent.md files and caches the names.
	 */
	private async scanAgents(token: vscode.CancellationToken): Promise<void> {
		this.logService.trace('[AgentsCompletion] scanAgents called');
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			this.logService.trace('[AgentsCompletion] No workspace folders found');
			return;
		}

		this.logService.trace(`[AgentsCompletion] Workspace folders: ${workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);

		const agentNames = new Set<string>();
		const agentPaths: string[] = [];

		for (const folder of workspaceFolders) {
			for (const agentDir of AgentsCompletionProvider.AGENT_DIRS) {
				this.logService.trace(`[AgentsCompletion] Scanning directory: ${path.join(folder.uri.fsPath, agentDir)}`);

				try {
					const files = await vscode.workspace.findFiles(
						new vscode.RelativePattern(folder, `${agentDir}/**/*.agent.md`),
						null,
						100,
						token
					);

					this.logService.trace(`[AgentsCompletion] Found ${files.length} agent files in ${agentDir}`);

					for (const file of files) {
						const name = path.basename(file.fsPath, '.agent.md');
						this.logService.trace(`[AgentsCompletion] Adding agent: ${name} from ${file.fsPath}`);
						agentNames.add(name);
						// Store the full path for object syntax
						agentPaths.push(file.fsPath);
					}
				} catch (error) {
					this.logService.error(`[AgentsCompletion] Error scanning ${agentDir}: ${error}`);
					// Directory may not exist, ignore
				}
			}
		}

		this.agentNames = Array.from(agentNames).sort();
		this.agentPaths = agentPaths.sort();
		this.logService.trace(`[AgentsCompletion] Final agent list: ${this.agentNames.join(', ')}`);
		this.logService.trace(`[AgentsCompletion] Final agent paths: ${this.agentPaths.join(', ')}`);
	}

	/**
	 * Sets up file system watchers to refresh cache when agent files change.
	 */
	private setupWatchers(): void {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		for (const folder of workspaceFolders) {
			for (const agentDir of AgentsCompletionProvider.AGENT_DIRS) {
				const pattern = new vscode.RelativePattern(folder, `${agentDir}/**/*.agent.md`);
				const watcher = vscode.workspace.createFileSystemWatcher(pattern);

				watcher.onDidCreate(() => this.refreshAgents());
				watcher.onDidDelete(() => this.refreshAgents());
				watcher.onDidChange(() => this.refreshAgents());

				this.watchers.push(watcher);
			}
		}
	}

	/**
	 * Refreshes the agent cache.
	 */
	private refreshAgents(): void {
		this.agentNames = [];
		this.agentPaths = [];
	}

	/**
	 * Creates a CompletionItem for an agent name (inline syntax).
	 */
	private makeCompletionItem(
		name: string,
		typedPrefix: string,
		range: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
		item.detail = 'Agent';
		item.insertText = name;
		item.range = range;
		item.sortText = name.toLowerCase();
		return item;
	}

	/**
	 * Creates a CompletionItem for an agent path (object syntax).
	 */
	private makePathCompletionItem(
		agentPath: string,
		typedPrefix: string,
		range: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(agentPath, vscode.CompletionItemKind.File);
		item.detail = 'Agent File';
		item.insertText = agentPath;
		item.range = range;
		item.sortText = agentPath.toLowerCase();
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