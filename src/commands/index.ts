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
			GalleryViewProvider.open(context);
		})
	);
	
	// Search flows — open the gallery panel (search box is inline in the webview)
	context.subscriptions.push(
		vscode.commands.registerCommand('feima.copilot-ai-flow.search', () => {
			GalleryViewProvider.open(context);
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
		vscode.commands.registerCommand('feima.copilot-ai-flow.openVisualEditor', async () => {
			logService.info('openVisualEditor command triggered');

			const activeEditor = vscode.window.activeTextEditor;
			
			if (!activeEditor) {
				logService.warn('No active editor found');
				vscode.window.showErrorMessage('No active editor. Please open a flow file first.');
				return;
			}
			
			const uri = activeEditor.document.uri;
			const filename = uri.fsPath;
			
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
				await vscode.commands.executeCommand('vscode.openWith', uri, 'feima.copilot-ai-flow.flowEditor');
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
			const activeEditor = vscode.window.activeTextEditor;
			
			if (!activeEditor) {
				vscode.window.showErrorMessage('No active editor. Please open a flow file first.');
				return;
			}
			
			const uri = activeEditor.document.uri;
			const filename = uri.fsPath;
			
			// Check if it's a flow file
			if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) {
				vscode.window.showErrorMessage('Please open a .flow.yaml or .flow.yml file first.');
				return;
			}
			
			// Determine current editor type and toggle
			// Check if we have a custom editor open for this document
			const tabEditors = vscode.window.tabGroups.all.flatMap(group => group.tabs).flatMap(tab => {
				if (tab.input instanceof vscode.TabInputCustom) {
					return tab.input;
				}
				return [];
			});
			
			const hasCustomEditor = tabEditors.some(editor => editor.uri.toString() === uri.toString());
			
			if (hasCustomEditor) {
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
}
