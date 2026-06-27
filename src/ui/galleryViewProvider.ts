/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { FlowLibrary } from '../flow/flowLibrary';
import { CatalogClient } from '../flow/catalogClient';
import { ILogger } from '../platform/log/common/logService';

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
	static open(context: vscode.ExtensionContext, log: ILogger): void {
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

		GalleryViewProvider._instance = new GalleryViewProvider(context, panel, log);
	}

	private readonly library: FlowLibrary;

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly _panel: vscode.WebviewPanel,
		private readonly log: ILogger,
	) {
		const catalogClient = new CatalogClient(context, log);
		this.library = new FlowLibrary(context, catalogClient);

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

				case 'openUrl':
					if (msg.url && typeof msg.url === 'string') {
						vscode.env.openExternal(vscode.Uri.parse(msg.url));
					}
					break;

				case 'openEditor':
					await this._handleOpenEditor(msg.id as string);
					break;

				case 'uninstall':
					await this._handleUninstall(msg.id as string, this._panel.webview);
					break;

				case 'viewYaml':
					await this._handleViewYaml(msg.id as string);
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

	/**
	 * Compute roleCount and orchestration from flow YAML for builtin flows.
	 * For catalog flows, these are already populated from the catalog index.
	 */
	private async _computeFlowMetadata(entry: any): Promise<{ roleCount?: number; orchestration?: 'sequence' | 'staged' | 'fork-join' }> {
		// Catalog flows already have these fields
		if (entry.source === 'catalog') {
			return { roleCount: entry.roleCount, orchestration: entry.orchestration };
		}

		// Builtin/workspace flows need YAML parsing
		if (!entry.filePath) {
			return {};
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(entry.filePath));
			const content = Buffer.from(bytes).toString('utf8');
			const doc = yaml.load(content) as any;

			if (!doc) {
				return {};
			}

			// Determine orchestration pattern
			let orchestration: 'sequence' | 'staged' | 'fork-join';
			if (Array.isArray(doc.stages) && doc.stages.length > 0) {
				orchestration = 'staged';
			} else if (Array.isArray(doc.groups) && doc.groups.length > 0) {
				orchestration = 'fork-join';
			} else {
				orchestration = 'sequence';
			}

			// Compute role count
			let roleCount = 0;
			if (Array.isArray(doc.roles)) {
				roleCount = doc.roles.length;
			} else if (Array.isArray(doc.stages)) {
				for (const stage of doc.stages) {
					if (Array.isArray(stage.roles)) {
						roleCount += stage.roles.length;
					}
				}
			} else if (Array.isArray(doc.groups)) {
				for (const group of doc.groups) {
					if (Array.isArray(group.roles)) {
						roleCount += group.roles.length;
					}
				}
			}

			return { roleCount, orchestration };
		} catch {
			return {};
		}
	}

	private async _sendFlows(webview: vscode.Webview): Promise<void> {
		const flows = await this.library.getAll();

		// Compute metadata for builtin/workspace flows
		const enrichedFlows = await Promise.all(
			flows.map(async (flow: any) => {
				const metadata = await this._computeFlowMetadata(flow);
				// Read raw YAML eagerly so compact previews render
				let yamlContent: string | undefined;
				if (flow.source === 'catalog' && flow.sourceUri) {
					try {
						yamlContent = await this.library.getCatalogFlowContent(flow);
					} catch {
						// ignore — preview will remain empty
					}
				} else if (flow.filePath) {
					try {
						const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(flow.filePath));
						yamlContent = Buffer.from(bytes).toString('utf8');
					} catch {
						// ignore — preview will remain empty
					}
				}
				return {
					...flow,
					roleCount: flow.roleCount ?? metadata.roleCount,
					orchestration: flow.orchestration ?? metadata.orchestration,
					// sourceUrl is already set for catalog flows, undefined for builtin
					// starCount is already set for catalog flows, undefined for builtin
					canEdit: flow.source === 'workspace',
					yamlContent,
				};
			})
		);

		webview.postMessage({ type: 'update', flows: enrichedFlows });
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
		if (entry.source === 'catalog' && entry.sourceUri) {
			try {
				const result = await this.library.getCatalogFlowContent(entry);
				webview.postMessage({ type: 'preview', id, content: result ?? '' });
				return;
			} catch {
				webview.postMessage({ type: 'preview', id, content: '' });
				return;
			}
		}
		if (!entry.filePath) {
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
			const { dest } = await this.library.install(entry, targetFolder);
			const rel = vscode.workspace.asRelativePath(dest);
			webview.postMessage({ type: 'installDone', id, success: true, message: `Installed to ${rel}` });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.log.error('Install flow failed', msg);
			if (msg.includes('already exists') || msg.includes('Installation cancelled')) {
				webview.postMessage({ type: 'installDone', id, success: true, message: 'Already installed.' });
			} else {
				webview.postMessage({ type: 'installDone', id, success: false, message: msg });
			}
		}
	}

	private async _handleOpenEditor(id: string): Promise<void> {
		const entry = await this.library.find(id);
		if (!entry) {
			return;
		}

		if (entry.source === 'catalog') {
			// Catalog flows have no local file — create in .github/flows/ and open
			const content = await this.library.getCatalogFlowContent(entry);
			if (!content) {
				vscode.window.showErrorMessage('Failed to fetch flow content');
				return;
			}

			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder open');
				return;
			}

			const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
			const targetPath = vscode.Uri.joinPath(flowsDir, `${entry.id}.flow.yaml`);

			try {
				// Check if file already exists
				let fileExists = false;
				try {
					await vscode.workspace.fs.stat(targetPath);
					fileExists = true;
				} catch {
					// File doesn't exist, which is what we want
				}

				if (fileExists) {
					const overwrite = await vscode.window.showWarningMessage(
						`Flow "${entry.name}" already exists in .github/flows/. Overwrite?`,
						{ modal: true },
						'Overwrite'
					);
					if (overwrite !== 'Overwrite') {
						return;
					}
				}

				// Create directory if it doesn't exist
				try {
					await vscode.workspace.fs.createDirectory(flowsDir);
				} catch (err) {
					// Directory might already exist, ignore error
				}

				// Write the file
				await vscode.workspace.fs.writeFile(targetPath, Buffer.from(content, 'utf8'));

				// Open in visual editor
				await vscode.commands.executeCommand('vscode.openWith', targetPath, 'feima.copilot-ai-flow.flowEditor');

				// Refresh gallery to show the flow as installed
				await this._sendFlows(this._panel.webview);

				vscode.window.showInformationMessage(`Installed "${entry.name}" to workspace`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Failed to install flow: ${msg}`);
			}
			return;
		}

		if (!entry.filePath) {
			return;
		}

		// Open in the visual (React Flow) editor
		const fileUri = vscode.Uri.file(entry.filePath);
		await vscode.commands.executeCommand('vscode.openWith', fileUri, 'feima.copilot-ai-flow.flowEditor');

		if (entry.source === 'builtin') {
			await this._showInstallPrompt(entry, 'This is a built-in flow. Changes will be lost when the extension updates. Install this flow to your workspace to save changes permanently.');
		}
	}

	private async _handleUninstall(id: string, webview: vscode.Webview): Promise<void> {
		const entry = await this.library.find(id);
		if (!entry || !entry.filePath) {
			return;
		}

		try {
			await vscode.workspace.fs.delete(vscode.Uri.file(entry.filePath));
			// Refresh the gallery
			await this._sendFlows(webview);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.log.error('Failed to uninstall flow', msg);
		}
	}

	private async _handleViewYaml(id: string): Promise<void> {
		const entry = await this.library.find(id);
		if (!entry) {
			return;
		}

		// For catalog flows without a file path, create in .github/flows/ and open as text
		if (!entry.filePath && entry.source === 'catalog') {
			const content = await this.library.getCatalogFlowContent(entry);
			if (!content) {
				vscode.window.showErrorMessage('Failed to fetch flow content');
				return;
			}

			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder open');
				return;
			}

			const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
			const targetPath = vscode.Uri.joinPath(flowsDir, `${entry.id}.flow.yaml`);

			try {
				// Check if file already exists
				let fileExists = false;
				try {
					await vscode.workspace.fs.stat(targetPath);
					fileExists = true;
				} catch {
					// File doesn't exist, which is what we want
				}

				if (fileExists) {
					const overwrite = await vscode.window.showWarningMessage(
						`Flow "${entry.name}" already exists in .github/flows/. Overwrite?`,
						{ modal: true },
						'Overwrite'
					);
					if (overwrite !== 'Overwrite') {
						return;
					}
				}

				// Create directory if it doesn't exist
				try {
					await vscode.workspace.fs.createDirectory(flowsDir);
				} catch (err) {
					// Directory might already exist, ignore error
				}

				// Write the file
				await vscode.workspace.fs.writeFile(targetPath, Buffer.from(content, 'utf8'));

				// Open as text document
				const doc = await vscode.workspace.openTextDocument(targetPath);
				await vscode.window.showTextDocument(doc, { preview: false });

				// Refresh gallery to show the flow as installed
				await this._sendFlows(this._panel.webview);

				vscode.window.showInformationMessage(`Installed "${entry.name}" to workspace`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Failed to install flow: ${msg}`);
			}
		} else if (entry.filePath) {
			const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(entry.filePath));
			await vscode.window.showTextDocument(doc, { preview: false });

			if (entry.source === 'builtin') {
				await this._showInstallPrompt(entry, 'This is a built-in flow. Changes will be lost when the extension updates. Install this flow to your workspace to save changes permanently.');
			}
		}
	}

	/**
		 * Show an info notification with an "Install to workspace" quick action.
		 * On install success, opens the newly installed file and refreshes the gallery.
		 */
	private async _showInstallPrompt(entry: import('../flow/flowSource').IFlowEntry, message: string): Promise<void> {
		const action = await vscode.window.showInformationMessage(message, 'Install to workspace');
		if (action !== 'Install to workspace') {
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showWarningMessage('No workspace folder is open. Open a workspace first to install flows.');
			return;
		}

		const targetFolder = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		try {
			const { dest } = await this.library.install(entry, targetFolder);
			// Open the newly installed file in the editor
			const installedDoc = await vscode.workspace.openTextDocument(dest);
			await vscode.window.showTextDocument(installedDoc, { preview: false });
			// Refresh the gallery so the flow shows as a workspace source
			await this._sendFlows(this._panel.webview);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('already exists') || msg.includes('Installation cancelled')) {
				vscode.window.showInformationMessage('Flow is already installed in the workspace.');
			} else {
				vscode.window.showErrorMessage(`Failed to install flow: ${msg}`);
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
