/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { ILogger } from '../platform/log/common/logService';
import { refToUri } from '../util/refToUri';

/**
 * Service for discovering flow files from various sources:
 * - Direct URI references (#file: attachments)
 * - Chat history references
 * - Name-based fuzzy search in .github/flows/
 * - Cached URI fallback
 */
export class FlowDiscoveryService {
	private readonly log: ILogger;
	/** Cached from the last successful request so retries without the reference still work. */
	private lastFlowUri: vscode.Uri | undefined;

	constructor(log: ILogger) {
		this.log = log;
	}

	/**
	 * Extract a URI from a ChatPromptReference using duck-typing.
	 * Delegates to shared util to avoid instanceof across the API proxy.
	 */
	public resolveRefUri(ref: vscode.ChatPromptReference): vscode.Uri | undefined {
		return refToUri(ref);
	}

	/** Scan a list of references and return the best flow-file URI. */
	public scanRefs(refs: readonly vscode.ChatPromptReference[]): vscode.Uri | undefined {
		for (const ref of refs) {
			const uri = refToUri(ref);
			if (!uri) { continue; }
			const lp = uri.path.toLowerCase();
			if (lp.endsWith('.flow.yaml') || lp.endsWith('.flow.yml')) { return uri; }
		}
		return undefined;
	}

	/**
	 * Check whether the given prompt matches a known flow file in .github/flows/.
	 * Returns true if the prompt is a flow name (not a natural-language question).
	 */
	public async isPromptFlowName(prompt: string): Promise<boolean> {
		const name = prompt.trim();
		if (!name) { return false; }
		const matches = await this.findFlowsByName(name);
		return matches.length >= 1;
	}

	/**
	 * Fuzzy-search `.github/flows/` in all workspace folders for `*.flow.yaml` files whose stem matches `name`.
	 */
	private async findFlowsByName(name: string): Promise<vscode.Uri[]> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) { return []; }

		const query = name.toLowerCase().trim();
		const queryWords = query.split(/[\s\-_]+/).filter(w => w.length > 2);
		const results: vscode.Uri[] = [];

		for (const folder of workspaceFolders) {
			const flowsDir = vscode.Uri.joinPath(folder.uri, '.github', 'flows');
			try {
				const entries = await vscode.workspace.fs.readDirectory(flowsDir);
				for (const [filename, type] of entries) {
					if (type !== vscode.FileType.File) { continue; }
					if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) { continue; }
					const stem = filename.replace(/\.flow\.(yaml|yml)$/, '').toLowerCase();
					if (stem.includes(query) || query.includes(stem) || queryWords.some(w => stem.includes(w))) {
						results.push(vscode.Uri.joinPath(flowsDir, filename));
					}
				}
			} catch {
				// .github/flows/ doesn't exist in this workspace folder — skip
			}
		}
		return results;
	}

	/**
	 * Find the .flow.yaml file for the current request.
	 * Resolution order:
	 *   1. Direct URI reference (`#file:` attachment in current request)
	 *   2. URI reference from chat history
	 *   3. Name-based fuzzy search in `.github/flows/` (matched against request.prompt)
	 *   4. Cached URI from the most recent successful request (retry fallback)
	 */
	async findFlowFile(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		token: vscode.CancellationToken
	): Promise<vscode.Uri | undefined> {
		// 1. Current request references (URI-based)
		const fromRequest = this.scanRefs(request.references);
		if (fromRequest) {
			this.lastFlowUri = fromRequest;
			return fromRequest;
		}

		// 2. History — search backwards; the most recent turn with a flow file wins
		for (let i = context.history.length - 1; i >= 0; i--) {
			const turn = context.history[i];
			if (turn instanceof vscode.ChatRequestTurn) {
				const fromHistory = this.scanRefs(turn.references);
				if (fromHistory) {
					this.lastFlowUri = fromHistory;
					return fromHistory;
				}
			}
		}

		// 3. Name-based search in .github/flows/ across all workspace folders
		const name = request.prompt.trim();
		if (name && !token.isCancellationRequested) {
			const matches = await this.findFlowsByName(name);
			if (matches.length === 1) {
				this.lastFlowUri = matches[0];
				return matches[0];
			}
			if (matches.length > 1) {
				const items = matches.map(uri => ({
					label: path.basename(uri.fsPath).replace(/\.flow\.(yaml|yml)$/, ''),
					description: vscode.workspace.asRelativePath(uri),
					uri,
				}));
				const picked = await vscode.window.showQuickPick(items, {
					placeHolder: `Multiple flows match "${name}" — pick one to run`,
					title: 'Select Flow',
				});
				if (picked) {
					this.lastFlowUri = picked.uri;
					return picked.uri;
				}
				return undefined; // User dismissed the picker
			}
		}

		// 4. Last-resort: cached URI from a previous successful request
		if (this.lastFlowUri) {
			this.log.debug(`No flow reference found — reusing cached URI: ${this.lastFlowUri.fsPath}`);
		}
		return this.lastFlowUri;
	}

	/** Clear the cached URI (useful for testing or reset scenarios) */
	clearCache(): void {
		this.lastFlowUri = undefined;
	}
}