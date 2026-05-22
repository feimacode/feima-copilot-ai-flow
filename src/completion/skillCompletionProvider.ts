/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Shape of a skill entry returned by the proposed `vscode.chat.getSkills()` API. */
interface ChatSkill {
	name: string;
	uri: vscode.Uri;
	description?: string;
	source?: string;
}

/**
 * Provides completion items for `skills:` arrays inside *.flow.yaml / *.flow.yml YAML documents.
 *
 * Triggers when the cursor is on a list item line (starts with optional whitespace + `- `)
 * that is nested under a `skills:` key, at any indentation depth. Works for both
 * flow-level skills and role-level skills.
 *
 * Example positions that trigger completions:
 *
 *   skills:
 *     - <cursor>
 *
 *   roles:
 *     - name: "Researcher"
 *       skills:
 *         - <cursor>
 */
export class SkillCompletionProvider implements vscode.CompletionItemProvider {

	/** Document selector: all *.flow.yaml / *.flow.yml files */
	static readonly selector: vscode.DocumentSelector = [
		{ pattern: '**/*.flow.yaml' },
		{ pattern: '**/*.flow.yml' },
		{ pattern: '**/*.prompt.md' },
	];

	/** Characters that re-trigger the completion list */
	static readonly triggerCharacters = ['-', ' '];

	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		_context: vscode.CompletionContext
	): Promise<vscode.CompletionItem[] | undefined> {

		// Only operate inside the YAML frontmatter block
		if (!this.isInFrontmatter(document, position)) {
			return undefined;
		}

		// Only trigger on lines that look like a YAML list item under skills:
		if (!this.isSkillsListItem(document, position)) {
			return undefined;
		}

		// Fetch all skills known to the platform
		const skills = await this.getSkills(token);
		if (!skills || skills.length === 0) {
			return undefined;
		}

		// Figure out what the user has already typed so we can replace it
		const lineText = document.lineAt(position).text;
		const listItemMatch = /^(\s*-\s*)(.*)$/.exec(lineText);
		const typedPrefix = listItemMatch?.[2] ?? '';
		const prefixStart = listItemMatch ? listItemMatch[1].length : position.character;
		const replaceRange = new vscode.Range(
			position.line, prefixStart,
			position.line, position.character
		);

		return skills.map(skill => this.makeCompletionItem(skill, typedPrefix, replaceRange));
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Returns true if `position` is inside the YAML document.
	 * For *.flow.yaml / *.flow.yml files the entire file is YAML — always returns true.
	 */
	private isInFrontmatter(_document: vscode.TextDocument, _position: vscode.Position): boolean {
		return true;
	}

	/**
	 * Returns true when the cursor is on a YAML list-item line (`  - `)
	 * whose nearest parent key is `skills:`.
	 *
	 * Strategy: walk upward from `position.line`, skip list-item lines at the
	 * same or deeper indentation, stop at the first key line at a shallower
	 * indentation, and check whether that key is `skills`.
	 */
	private isSkillsListItem(document: vscode.TextDocument, position: vscode.Position): boolean {
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

			const indentMatch = /^(\s*)/.exec(line);
			const indent = indentMatch ? indentMatch[1].length : 0;

			// Found a line at a shallower indentation — this is our parent key
			if (indent < currentIndent) {
				// Match `skills:` (with optional trailing space/comment)
				return /^\s*skills\s*:/.test(line);
			}
		}

		return false;
	}

	/**
	 * Calls `vscode.chat.getSkills()` if available (requires `chatPromptFiles`
	 * proposed API). Gracefully returns an empty array if the API is absent.
	 */
	private async getSkills(token: vscode.CancellationToken): Promise<readonly ChatSkill[]> {
		try {
			// `vscode.chat.getSkills` is a proposed API — guard against absence
			const getSkills = (vscode.chat as { getSkills?: (token: vscode.CancellationToken) => Thenable<readonly ChatSkill[]> }).getSkills;
			if (typeof getSkills !== 'function') {
				return [];
			}
			return await getSkills.call(vscode.chat, token);
		} catch {
			return [];
		}
	}

	private makeCompletionItem(
		skill: ChatSkill,
		typedPrefix: string,
		replaceRange: vscode.Range
	): vscode.CompletionItem {
		const item = new vscode.CompletionItem(skill.name, vscode.CompletionItemKind.Reference);

		// Replace the partial text already typed
		item.range = replaceRange;
		item.insertText = skill.name;
		item.filterText = skill.name;

		// Rich detail shown in the completion popup
		item.detail = skill.source ? `skill · ${skill.source}` : 'skill';
		if (skill.description) {
			item.documentation = new vscode.MarkdownString(
				`**${skill.name}**\n\n${skill.description}\n\n*Source: \`${skill.uri.fsPath}\`*`
			);
		}

		// Boost skills that start with what the user typed
		item.sortText = skill.name.toLowerCase().startsWith(typedPrefix.toLowerCase())
			? `0_${skill.name}`
			: `1_${skill.name}`;

		// Commit the completion on Tab or Enter
		item.commitCharacters = ['\n'];

		return item;
	}
}
