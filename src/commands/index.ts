/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LibraryTreeProvider, LibraryItem } from '../ui/browserView';

export function registerCommands(
	context: vscode.ExtensionContext,
	treeProvider: LibraryTreeProvider
) {
	
	// Browse prompt library
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.browse', async () => {
			await vscode.commands.executeCommand('copilot-ai-panel.library.focus');
		})
	);
	
	// Search prompts
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.search', async () => {
			const query = await vscode.window.showInputBox({
				prompt: 'Search prompts by name, tag, or category',
				placeHolder: 'e.g., sprint, architecture, review'
			});
			
			if (query) {
				vscode.window.showInformationMessage(`Search for: ${query} (coming soon)`);
			}
		})
	);
	
	// Use prompt
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.usePrompt', async (item: LibraryItem) => {
			if (item.filePath) {
				const uri = vscode.Uri.file(item.filePath);
				const relativePath = vscode.workspace.asRelativePath(uri);
				const chatInput = `@panel #file:${uri.fsPath} `;
				
				// Insert into chat
				await vscode.commands.executeCommand('workbench.action.chat.open', {
					query: chatInput
				});
			}
		})
	);
	
	// Copy prompt to workspace
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.copyToWorkspace', async (item: LibraryItem) => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('Please open a workspace first');
				return;
			}
			
			if (!item.filePath) {
				return;
			}
			
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
			const sourceUri = vscode.Uri.file(item.filePath);
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
					query: `@panel #file:${targetUri.fsPath} `
				});
			}
		})
	);
	
	// Create from template
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.createFromTemplate', async () => {
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
		vscode.commands.registerCommand('copilot-ai-panel.installCategory', async () => {
			vscode.window.showInformationMessage('Install category (coming soon)');
		})
	);
	
	// List available language model tools (for debugging)
	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-ai-panel.listTools', async () => {
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
