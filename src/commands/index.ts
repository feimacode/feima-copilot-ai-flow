/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GalleryViewProvider } from '../ui/galleryViewProvider';

export function registerCommands(context: vscode.ExtensionContext) {
	
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
}
