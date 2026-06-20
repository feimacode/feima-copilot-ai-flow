/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import { IFlowEntry } from '../flow/flowSource';

/**
 * Custom text editor that renders *.flow.yaml / *.flow.yml files as a React Flow canvas.
 *
 * Both this editor and the default text editor are available simultaneously:
 * - This provider is registered as the DEFAULT for *.flow.yaml / *.flow.yml (opens the GUI).
 * - Users can switch to the text editor via "Reopen with Text Editor" or the
 *   "Edit Source" toolbar button in the canvas (opens in a side-by-side pane).
 * - All edits made in either view are reflected in the other via the shared
 *   TextDocument model that VS Code owns.
 */
export class FlowEditorProvider implements vscode.CustomTextEditorProvider {

	public static readonly viewType = 'feima.copilot-ai-flow.flowEditor';

	static register(context: vscode.ExtensionContext): vscode.Disposable {
		return vscode.window.registerCustomEditorProvider(
			FlowEditorProvider.viewType,
			new FlowEditorProvider(context),
			{
				// Allow both the canvas and a text editor to be open at the same time.
				supportsMultipleEditorsPerDocument: true,
				webviewOptions: { retainContextWhenHidden: true },
			}
		);
	}

	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewFlow: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		webviewFlow.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
			],
		};

		webviewFlow.webview.html = this.buildHtml(webviewFlow.webview);

		// Push latest document content to the webview.
		const sendUpdate = () => {
			webviewFlow.webview.postMessage({ type: 'update', content: document.getText() });
		};

		// Tracks the last YAML string the webview sent us. When `onDidChangeTextDocument`
		// fires because WE applied a webview edit, the new document text will equal this
		// value — we skip the echo-back to avoid an infinite update loop.
		let lastWebviewContent = '';

		// Handle messages coming from the extension host.
		const messageSubscription = webviewFlow.webview.onDidReceiveMessage(msg => {
			switch (msg.type) {
				case 'ready':
					// Webview is mounted and ready to receive the initial document.
					sendUpdate();
					break;

				case 'change': {
					// Guard: skip no-op edits (e.g. position-only drag that doesn't
					// affect YAML) to avoid marking the document dirty unnecessarily.
					if (msg.content === document.getText()) { break; }
					lastWebviewContent = msg.content;
					const edit = new vscode.WorkspaceEdit();
					edit.replace(
						document.uri,
						new vscode.Range(0, 0, document.lineCount, 0),
						msg.content
					);
					vscode.workspace.applyEdit(edit);
					break;
				}

				case 'openTextEditor':
					// "Edit Source" button: open the raw text alongside the canvas.
					vscode.window.showTextDocument(document.uri, {
						viewColumn: vscode.ViewColumn.Beside,
						preview: false,
					});
					break;
			}
		});

		// Forward external text changes (e.g. from the text editor pane) to the canvas.
		// Skip the echo when the change was caused by the webview itself.
		const changeSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() !== document.uri.toString()) { return; }
			if (document.getText() === lastWebviewContent) { return; }
			sendUpdate();
		});

		webviewFlow.onDidDispose(() => {
			messageSubscription.dispose();
			changeSubscription.dispose();
		});
	}

	/**
	 * Scan the extension's `examples/` directory for flow files and return them
	 * as template gallery entries. Used by the editor's template picker.
	 */
	async scanExamples(): Promise<IFlowEntry[]> {
		const examplesDir = vscode.Uri.joinPath(this.context.extensionUri, 'examples');
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
				const metadata = await this.parseExampleMetadata(filePath);

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
			console.warn('FlowEditorProvider: Failed to scan examples directory:', error);
		}

		return results.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async parseExampleMetadata(uri: vscode.Uri): Promise<{
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
		if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))) {
			return trimmed.slice(1, -1);
		}
		return trimmed;
	}

	private parseYamlArray(inlineValue: string, lines: string[], currentIndex: number): string[] | undefined {
		const trimmed = inlineValue.trim();

		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			return trimmed.slice(1, -1)
				.split(',')
				.map(s => this.parseYamlString(s.trim()) || '')
				.filter(Boolean);
		}

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

	private buildHtml(webview: vscode.Webview): string {
		const nonce = crypto.randomBytes(16).toString('hex');

		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'editor.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'editor.css')
		);

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src 'unsafe-inline' ${webview.cspSource};
             img-src ${webview.cspSource} data:;
             font-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Flow Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}
