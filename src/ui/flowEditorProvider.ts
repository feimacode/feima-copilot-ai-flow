/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';

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

	public static readonly viewType = 'copilot-ai-flow.flowEditor';

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
