/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FlowParticipant } from './flow/flowParticipant';
import { FlowEditorProvider } from './ui/flowEditorProvider';
import { registerCommands } from './commands';
import { SkillCompletionProvider } from './completion/skillCompletionProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Copilot AI Flow extension is activating...');

	// Register the @flow participant
	const participant = new FlowParticipant(context);
	context.subscriptions.push(participant.register());

	// Register the React Flow canvas editor for *.flow.yaml / *.flow.yml files.
	// Users can switch to the plain text editor via "Reopen with Text Editor"
	// or by clicking "Edit Source" in the canvas toolbar.
	context.subscriptions.push(FlowEditorProvider.register(context));

	// Register skill name completions inside *.flow.yaml / *.flow.yml / *.prompt.md
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			SkillCompletionProvider.selector,
			new SkillCompletionProvider(),
			...SkillCompletionProvider.triggerCharacters
		)
	);

	// Register all commands
	registerCommands(context);

	console.log('Copilot AI Flow extension activated successfully');
}

export function deactivate() {
	console.log('Copilot AI Flow extension deactivated');
}
