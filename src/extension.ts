/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PanelParticipant } from './panel/panelParticipant';
import { LibraryTreeProvider } from './ui/browserView';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
	console.log('Copilot AI Panel extension is activating...');

	// Register the @panel participant
	const participant = new PanelParticipant(context);
	context.subscriptions.push(participant.register());

	// Register the library tree view
	const treeProvider = new LibraryTreeProvider(context);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('copilot-ai-panel.library', treeProvider)
	);

	// Register all commands
	registerCommands(context, treeProvider);

	console.log('Copilot AI Panel extension activated successfully');
}

export function deactivate() {
	console.log('Copilot AI Panel extension deactivated');
}
