/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GalleryViewProvider } from '../ui/galleryViewProvider';
import { ILogService } from '../platform/log/common/logService';

export function registerCommands(context: vscode.ExtensionContext, logService: ILogService) {
	
	// Browse gallery
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.browse', () => {
			GalleryViewProvider.open(context, logService);
		})
	);
	
	// Search flows — open the gallery panel (search box is inline in the webview)
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.search', () => {
			GalleryViewProvider.open(context, logService);
		})
	);
	
	// Use prompt — accepts a file URI or path string
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.usePrompt', async (filePathOrUri: string | vscode.Uri) => {
			const uri = typeof filePathOrUri === 'string'
				? vscode.Uri.file(filePathOrUri)
				: filePathOrUri;
			await vscode.commands.executeCommand('workbench.action.chat.open', {
				query: `@flow #file:${uri.fsPath} `
			});
		})
	);
	
	// Copy prompt to workspace — accepts a file URI or path string
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.copyToWorkspace', async (filePathOrUri: string | vscode.Uri) => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('Please open a workspace first');
				return;
			}

			const sourceUri = typeof filePathOrUri === 'string'
				? vscode.Uri.file(filePathOrUri)
				: filePathOrUri;

			// Ask where to save
			const targetFolder = await vscode.window.showInputBox({
				prompt: 'Enter folder path (relative to workspace root)',
				value: 'prompts',
				placeHolder: 'prompts'
			});

			if (!targetFolder) {
				return;
			}

			// Create target directory
			const targetDir = vscode.Uri.joinPath(workspaceFolder.uri, targetFolder);
			await vscode.workspace.fs.createDirectory(targetDir);

			// Copy file
			const fileName = sourceUri.path.split('/').pop() || 'prompt.md';
			const targetUri = vscode.Uri.joinPath(targetDir, fileName);
			
			const content = await vscode.workspace.fs.readFile(sourceUri);
			await vscode.workspace.fs.writeFile(targetUri, content);
			
			const action = await vscode.window.showInformationMessage(
				`Prompt copied to ${targetFolder}/${fileName}`,
				'Open File',
				'Use Now'
			);
			
			if (action === 'Open File') {
				await vscode.window.showTextDocument(targetUri);
			} else if (action === 'Use Now') {
				await vscode.commands.executeCommand('workbench.action.chat.open', {
					query: `@flow #file:${targetUri.fsPath} `
				});
			}
		})
	);
	
	// Create from template
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.createFromTemplate', async () => {
			const template = await vscode.window.showQuickPick([
				{ label: 'Sprint Planning', description: '4 roles: Dev, QA, PO, Tech Lead', value: 'sprint' },
				{ label: 'Architecture Review', description: '3 roles: Solutions, Security, Performance', value: 'architecture' },
				{ label: 'Code Review', description: '3 roles: Senior Dev, Security, Performance', value: 'code-review' },
				{ label: 'Blank Template', description: 'Start from scratch', value: 'blank' }
			], {
				placeHolder: 'Choose a template'
			});
			
			if (!template) {
				return;
			}
			
			vscode.window.showInformationMessage(`Create from ${template.label} (coming soon)`);
		})
	);
	
	// Install category
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.installCategory', async () => {
			vscode.window.showInformationMessage('Install category (coming soon)');
		})
	);
	
	// List available language model tools (for debugging)
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.listTools', async () => {
			const tools = vscode.lm.tools;
			
			if (!tools || tools.length === 0) {
				vscode.window.showInformationMessage('No language model tools are currently registered.');
				return;
			}
			
			// Create output with all tool information
			const toolList = tools.map((tool, i) => 
				`${i + 1}. ${tool.name}\n   Description: ${tool.description}\n   Input Schema: ${tool.inputSchema ? 'Yes' : 'No'}`
			).join('\n\n');
			
			// Show in a new document
			const doc = await vscode.workspace.openTextDocument({
				content: `Available Language Model Tools (${tools.length}):\n\n${toolList}`,
				language: 'markdown'
			});
			
			await vscode.window.showTextDocument(doc);
			
			vscode.window.showInformationMessage(`Found ${tools.length} registered tool(s)`);
		})
	);

	// Open visual editor for the current flow file
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.openVisualEditor', async (uri?: vscode.Uri) => {
			logService.info('openVisualEditor command triggered');

			// If URI is provided (e.g., from explorer context menu), use it
			// Otherwise, use the active editor's document
			let targetUri: vscode.Uri;
			if (uri) {
				targetUri = uri;
			} else {
				// Try text editor first
				const activeTextEditor = vscode.window.activeTextEditor;
				if (activeTextEditor) {
					targetUri = activeTextEditor.document.uri;
				} else {
					// Try custom editor (visual editor)
					const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
					if (activeTab && activeTab.input instanceof vscode.TabInputCustom) {
						targetUri = activeTab.input.uri;
					} else {
						logService.warn('No active editor found');
						vscode.window.showErrorMessage('No active editor. Please open a flow file first.');
						return;
					}
				}
			}
			
			const filename = targetUri.fsPath;
			
			logService.info(`Attempting to open visual editor for: ${filename}`);
			
			// Check if it's a flow file
			if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) {
				logService.warn(`Not a flow file: ${filename}`);
				vscode.window.showErrorMessage('Please open a .flow.yaml or .flow.yml file first.');
				return;
			}
			
			// Open with the custom editor
			try {
				logService.info(`Opening with custom editor: feima.copilot-ai-flow.flowEditor`);
				await vscode.commands.executeCommand('vscode.openWith', targetUri, 'feima.copilot-ai-flow.flowEditor');
				logService.info('Visual editor opened successfully');
			} catch (error) {
				logService.error(`Failed to open visual editor: ${error}`);
				vscode.window.showErrorMessage(`Failed to open visual editor: ${error}`);
			}
		})
	);

	// Toggle between text and visual editor
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.toggleEditor', async () => {
			let uri: vscode.Uri;
			let isCurrentlyVisualEditor = false;
			
			// Check if we're in a text editor
			const activeTextEditor = vscode.window.activeTextEditor;
			if (activeTextEditor) {
				uri = activeTextEditor.document.uri;
				isCurrentlyVisualEditor = false;
			} else {
				// Check if we're in a custom editor
				const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
				if (activeTab && activeTab.input instanceof vscode.TabInputCustom) {
					uri = activeTab.input.uri;
					isCurrentlyVisualEditor = activeTab.input.viewType === 'feima.copilot-ai-flow.flowEditor';
				} else {
					vscode.window.showErrorMessage('No active editor. Please open a flow file first.');
					return;
				}
			}

			const filename = uri.fsPath;
			
			// Check if it's a flow file
			if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) {
				vscode.window.showErrorMessage('Please open a .flow.yaml or .flow.yml file first.');
				return;
			}
			
			if (isCurrentlyVisualEditor) {
				// Currently in visual editor, switch to text editor
				await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
			} else {
				// Currently in text editor, switch to visual editor
				try {
					await vscode.commands.executeCommand('vscode.openWith', uri, 'feima.copilot-ai-flow.flowEditor');
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to open visual editor: ${error}`);
				}
			}
		})
	);

	// Open text editor for the current flow file (switch from visual editor)
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.openTextEditor', async () => {
			logService.info('openTextEditor command triggered');

			// Get the active tab
			const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
			if (!activeTab || !(activeTab.input instanceof vscode.TabInputCustom)) {
				logService.warn('No active custom editor found');
				vscode.window.showErrorMessage('No active custom editor. Please open a flow file in the visual editor first.');
				return;
			}

			// Check if it's our visual editor
			if (activeTab.input.viewType !== 'feima.copilot-ai-flow.flowEditor') {
				logService.warn('Active custom editor is not the flow visual editor');
				vscode.window.showErrorMessage('Please open a flow file in the visual editor first.');
				return;
			}

			const uri = activeTab.input.uri;
			const filename = uri.fsPath;

			logService.info(`Switching to text editor for: ${filename}`);

			// Check if it's a flow file
			if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) {
				logService.warn(`Not a flow file: ${filename}`);
				vscode.window.showErrorMessage('Please open a .flow.yaml or .flow.yml file first.');
				return;
			}

			// Switch to default text editor
			try {
				logService.info(`Switching to default text editor`);
				await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
				logService.info('Switched to text editor successfully');
			} catch (error) {
				logService.error(`Failed to switch to text editor: ${error}`);
				vscode.window.showErrorMessage(`Failed to switch to text editor: ${error}`);
			}
		})
	);

	// Run flow — open chat with @flow #file:<path>
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.runFlow', async (uri?: vscode.Uri) => {
			let targetUri: vscode.Uri;
			if (uri) {
				targetUri = uri;
			} else {
				const activeTextEditor = vscode.window.activeTextEditor;
				if (activeTextEditor) {
					targetUri = activeTextEditor.document.uri;
				} else {
					const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
					if (activeTab && activeTab.input instanceof vscode.TabInputCustom) {
						targetUri = activeTab.input.uri;
					} else {
						vscode.window.showErrorMessage('No flow file open. Please open a .flow.yaml file first.');
						return;
					}
				}
			}

			const filename = targetUri.fsPath;
			if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) {
				vscode.window.showErrorMessage('The active file is not a .flow.yaml file.');
				return;
			}

			// Ask user for the initial prompt
			const prompt = await vscode.window.showInputBox({
				prompt: 'What would you like the flow to do?',
				placeHolder: 'e.g. Review the authentication module for security issues',
				validateInput: (value) => value.trim() ? undefined : 'Please enter a prompt to start the flow.',
			});

			if (!prompt) { return; }

			await vscode.commands.executeCommand('workbench.action.chat.open', {
				query: `@flow #file:${targetUri.fsPath} ${prompt}`
			});
		})
	);
}
