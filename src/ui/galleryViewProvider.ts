/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { FlowLibrary } from '../flow/flowLibrary';

/**
 * Editor-area WebviewPanel showing a React-based search gallery of built-in flows.
 * Opens as an editor tab (singleton — a second call to `open()` simply reveals the
 * existing panel). Each card supports metadata display, an expandable React Flow
 * preview, and an Install button that copies the flow into `.github/flows/`.
 */
export class GalleryViewProvider {

	private static readonly _panelType = 'copilot-ai-flow.gallery';
	private static _instance: GalleryViewProvider | undefined;

	/** Open the gallery, or reveal it if already open. */
	static open(context: vscode.ExtensionContext): void {
		if (GalleryViewProvider._instance) {
			GalleryViewProvider._instance._panel.reveal();
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			GalleryViewProvider._panelType,
			'Flow Gallery',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')],
			}
		);

		GalleryViewProvider._instance = new GalleryViewProvider(context, panel);
	}

	private readonly library: FlowLibrary;

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly _panel: vscode.WebviewPanel,
	) {
		this.library = new FlowLibrary(context);

		this._panel.webview.html = this._buildHtml(this._panel.webview);

		this._panel.webview.onDidReceiveMessage(async msg => {
			switch (msg.type) {
				case 'ready':
					await this._sendFlows(this._panel.webview);
					break;

				case 'getPreview':
					await this._sendPreview(msg.id as string, this._panel.webview);
					break;

				case 'install':
					await this._handleInstall(msg.id as string, this._panel.webview);
					break;

				case 'createFromTemplate':
					await vscode.commands.executeCommand('copilot-ai-flow.createFromTemplate');
					break;
			}
		});

		this._panel.onDidDispose(() => {
			GalleryViewProvider._instance = undefined;
		});
	}

	/** Push fresh flow data into an already-open panel. */
	refresh(): void {
		this._sendFlows(this._panel.webview);
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	private async _sendFlows(webview: vscode.Webview): Promise<void> {
		const flows = await this.library.getAll();
		webview.postMessage({ type: 'update', flows });
	}

	/**
	 * Read the raw YAML of the requested flow and send it back so the
	 * gallery's FlowPreview component can render a mini canvas.
	 */
	private async _sendPreview(id: string, webview: vscode.Webview): Promise<void> {
		const entry = await this.library.find(id);
		if (!entry) {
			webview.postMessage({ type: 'preview', id, content: '' });
			return;
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(entry.filePath));
			const content = Buffer.from(bytes).toString('utf8');
			webview.postMessage({ type: 'preview', id, content });
		} catch {
			webview.postMessage({ type: 'preview', id, content: '' });
		}
	}

	private async _handleInstall(id: string, webview: vscode.Webview): Promise<void> {
		const entry = await this.library.find(id);
		if (!entry) {
			webview.postMessage({ type: 'installDone', id, success: false, message: 'Flow not found.' });
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			webview.postMessage({ type: 'installDone', id, success: false, message: 'No workspace folder open.' });
			return;
		}

		const targetFolder = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		try {
			await vscode.workspace.fs.createDirectory(targetFolder);
			const dest = await this.library.install(entry, targetFolder);
			const rel = vscode.workspace.asRelativePath(dest);
			webview.postMessage({ type: 'installDone', id, success: true, message: `Installed to ${rel}` });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('FileExistsError') || msg.includes('already exists') || msg.includes('EntryExists')) {
				webview.postMessage({ type: 'installDone', id, success: true, message: 'Already installed.' });
			} else {
				webview.postMessage({ type: 'installDone', id, success: false, message: msg });
			}
		}
	}

	private _buildHtml(webview: vscode.Webview): string {
		const nonce = crypto.randomBytes(16).toString('hex');
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'gallery.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'gallery.css')
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
  <title>Flow Gallery</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}
