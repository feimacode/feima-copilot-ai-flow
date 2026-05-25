/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FlowParticipant } from './flow/flowParticipant';
import { FlowEditorProvider } from './ui/flowEditorProvider';
import { registerCommands } from './commands';
import { SkillCompletionProvider } from './completion/skillCompletionProvider';
import { LogServiceImpl } from './platform/log/common/logService';
import { VSCodeLogTarget, ConsoleLogTarget } from './platform/log/vscode/logService';
import { LogLevel } from './platform/log/common/logService';

export function activate(context: vscode.ExtensionContext) {
	const logChannel = vscode.window.createOutputChannel('Copilot AI Flow', { log: true });
	context.subscriptions.push(logChannel);

	const logService = new LogServiceImpl([
		new VSCodeLogTarget(logChannel),
		new ConsoleLogTarget('[Flow] ', LogLevel.Error)
	]);

	logService.info('Copilot AI Flow extension is activating...');

	// Register the @flow participant
	const participant = new FlowParticipant(context, logService);
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

	logService.info('Copilot AI Flow extension activated successfully');
}

export function deactivate() {
	// deactivation logging is best-effort; output channel may already be disposed
}
