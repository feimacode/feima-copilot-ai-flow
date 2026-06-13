/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ILogService } from '../platform/log/common/logService';

/**
 * Provides completion items for `tools:` arrays inside *.flow.yaml / *.flow.yml YAML documents.
 *
 * Triggers when the cursor is on a list item line (starts with optional whitespace + `- `)
 * that is nested under a `tools:` key, at any indentation depth. Works for both
 * flow-level tools and role-level tools.
 *
 * Example positions that trigger completions:
 *
 *   tools:
 *     - <cursor>
 *
 *   roles:
 *     - name: "Researcher"
 *       tools:
 *         - <cursor>
 */
export class ToolsCompletionProvider implements vscode.CompletionItemProvider {

	/** Document selector: all *.flow.yaml / *.flow.yml files */
	static readonly selector: vscode.DocumentSelector = [
		{ pattern: '**/*.flow.yaml' },
		{ pattern: '**/*.flow.yml' },
	];

	/** Characters that re-trigger the completion list */
	static readonly triggerCharacters = ['-', ' '];

	constructor(private readonly logService: ILogService) {}

	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext
	): Promise<vscode.CompletionItem[] | undefined> {

		this.logService.trace('[ToolsCompletion] provideCompletionItems called');
		this.logService.trace(`[ToolsCompletion] Document: ${document.fileName}`);
		this.logService.trace(`[ToolsCompletion] Position: ${position.line}:${position.character}`);

		// Only operate inside flow YAML files
		if (!this.isFlowFile(document)) {
			this.logService.trace('[ToolsCompletion] Not a flow file, returning undefined');
			return undefined;
		}

		// Only trigger on lines that look like a YAML list item under tools:
		if (!this.isToolsListItem(document, position)) {
			this.logService.trace('[ToolsCompletion] Not a tools list item, returning undefined');
			return undefined;
		}

		this.logService.trace('[ToolsCompletion] Tools list item detected, fetching tools...');

		// Get all available tools from vscode.lm.tools
		const tools = vscode.lm.tools;
		if (!tools || tools.length === 0) {
			this.logService.trace('[ToolsCompletion] No tools found, returning undefined');
			return undefined;
		}

		this.logService.trace(`[ToolsCompletion] Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);

		// Figure out what the user has already typed so we can replace it
		const lineText = document.lineAt(position).text;
		const listItemMatch = /^(\s*-\s*)(.*)$/.exec(lineText);
		const typedPrefix = listItemMatch?.[2] ?? '';
		const prefixStart = listItemMatch ? listItemMatch[1].length : position.character;
		const replaceRange = new vscode.Range(
			position.line, prefixStart,
			position.line, position.character
		);

		return tools.map(tool => this.makeCompletionItem(tool, typedPrefix, replaceRange));
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
	 * Returns true when the cursor is on a YAML list-item line (`  - `)
	 * whose nearest parent key is `tools`.
	 *
	 * Strategy: walk upward from `position.line`, skip list-item lines at the
	 * same or deeper indentation, stop at the first key line at a shallower
	 * indentation, and check whether that key is `tools`.
	 */
	private isToolsListItem(document: vscode.TextDocument, position: vscode.Position): boolean {
		const currentLine = document.lineAt(position).text;

		// Current line must be a list item
		const listItemRe = /^(\s*)-\s/;
		const currentMatch = listItemRe.exec(currentLine);
		if (!currentMatch) {
			return false;
		}

		const currentIndent = currentMatch[1].length;

		// Walk upward to find the parent key
		for (let ln = position.line - 1; ln >= 0; ln--) {
			const line = document.lineAt(ln).text;

			// Skip blank lines
			if (line.trim() === '') {
				continue;
			}

			// Skip list items at same or deeper indentation
			const listMatch = listItemRe.exec(line);
			if (listMatch && listMatch[1].length >= currentIndent) {
				continue;
			}

			// Check if this is a key line at shallower indentation
			const keyMatch = /^(\s*)(\w+):/.exec(line);
			if (keyMatch && keyMatch[1].length < currentIndent) {
				return keyMatch[2] === 'tools';
			}

			// If we hit something else at shallower indentation, stop
			return false;
		}

		return false;
	}

	/**
	 * Creates a CompletionItem for a tool.
	 */
	private makeCompletionItem(
		tool: vscode.LanguageModelToolInformation,
		typedPrefix: string,
		range: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(tool.name, vscode.CompletionItemKind.Function);
		item.detail = tool.name;
		item.documentation = tool.description;
		item.insertText = tool.name;
		item.range = range;
		item.sortText = tool.name.toLowerCase();
		return item;
	}
}