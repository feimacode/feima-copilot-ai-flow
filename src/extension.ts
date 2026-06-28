/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FlowParticipant } from './flow/flowParticipant';
import { FlowLibrary } from './flow/flowLibrary';
import { FlowEditorProvider } from './ui/flowEditorProvider';
import { registerCommands } from './commands';
import { SkillCompletionProvider } from './completion/skillCompletionProvider';
import { ToolsCompletionProvider } from './completion/toolsCompletionProvider';
import { AgentsCompletionProvider } from './completion/agentsCompletionProvider';
import { PromptsCompletionProvider } from './completion/promptsCompletionProvider';
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

	// Register URI handler for deep-link flow installation.
	// Handles: vscode://feima.copilot-ai-flow/install?flow=<id>
	// and:     vscode-insiders://feima.copilot-ai-flow/install?flow=<id>
	registerFlowUriHandler(context, participant.getLibrary(), logService);

	// Register the React Flow canvas editor for *.flow.yaml / *.flow.yml files.
	// Users can switch to the plain text editor via "Reopen with Text Editor"
	// or by clicking "Edit Source" in the canvas toolbar.
	context.subscriptions.push(FlowEditorProvider.register(context));

	// Register skill name completions inside *.flow.yaml / *.flow.yml / *.prompt.md
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			SkillCompletionProvider.selector,
			new SkillCompletionProvider(logService),
			...SkillCompletionProvider.triggerCharacters
		)
	);

	// Register tool name completions inside *.flow.yaml / *.flow.yml
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			ToolsCompletionProvider.selector,
			new ToolsCompletionProvider(logService),
			...ToolsCompletionProvider.triggerCharacters
		)
	);

	// Register agent file completions inside *.flow.yaml / *.flow.yml
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			AgentsCompletionProvider.selector,
			new AgentsCompletionProvider(logService),
			...AgentsCompletionProvider.triggerCharacters
		)
	);

	// Register prompt file completions inside *.flow.yaml / *.flow.yml
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			PromptsCompletionProvider.selector,
			new PromptsCompletionProvider(logService),
			...PromptsCompletionProvider.triggerCharacters
		)
	);

	// Register all commands — pass the library so install buttons can work directly
	registerCommands(context, logService, participant.getLibrary());

	logService.info('Copilot AI Flow extension activated successfully');
}

/**
 * Register a URI handler that responds to flow deep-links.
 *
 * Supported URI formats:
 *   vscode://feima.copilot-ai-flow/install?flow=<id>     — installs the flow, opens Copilot Chat
 *   vscode://feima.copilot-ai-flow/open?flow=<id>         — opens the installed flow in the graph editor
 *   (vscode-insiders:// works identically for both)
 */
function registerFlowUriHandler(
	context: vscode.ExtensionContext,
	library: FlowLibrary,
	logService: LogServiceImpl
): void {
	const handler = vscode.window.registerUriHandler({
		handleUri: async (uri: vscode.Uri): Promise<void> => {
			const path = uri.path;
			if (path !== '/install' && path !== '/open') {
				return;
			}

			const query = new URLSearchParams(uri.query);
			const flowId = query.get('flow');
			if (!flowId) {
				logService.warn(`[URI] ${path} request missing flow parameter`);
				vscode.window.showWarningMessage(vscode.l10n.t('Deep-link is missing a flow name.'));
				return;
			}

			logService.info(`[URI] Deep-link ${path} requested for flow: ${flowId}`);

			if (path === '/open') {
				await handleOpenFlow(flowId, context, logService);
			} else {
				await handleInstallFlow(flowId, library, context, logService);
			}
		},
	});

	context.subscriptions.push(handler);
	logService.info('[URI] Flow deep-link handler registered');
}

/**
 * Handle `/open?flow=<id>` — opens the installed flow in the graph editor.
 * If not installed, installs it first.
 */
async function handleOpenFlow(
	flowId: string,
	context: vscode.ExtensionContext,
	logService: LogServiceImpl
): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage(vscode.l10n.t('Open a workspace folder first to view flows.'));
		return;
	}

	const flowPath = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows', `${flowId}.flow.yaml`);

	// Check if the flow file exists
	try {
		await vscode.workspace.fs.stat(flowPath);
	} catch {
		vscode.window.showErrorMessage(
			vscode.l10n.t('Flow "{0}" is not installed. Open the flow gallery to install it first.', flowId)
		);
		return;
	}

	logService.info(`[URI] Opening flow in editor: ${flowPath.fsPath}`);
	await vscode.commands.executeCommand(
		'vscode.openWith',
		flowPath,
		'feima.copilot-ai-flow.flowEditor'
	);
}

/**
 * Handle `/install?flow=<id>` — installs the flow and opens Copilot Chat.
 */
async function handleInstallFlow(
	flowId: string,
	library: FlowLibrary,
	context: vscode.ExtensionContext,
	logService: LogServiceImpl
): Promise<void> {
	try {
		// Find the flow across all sources (builtin, catalog, workspace)
		const entry = await library.find(flowId);
		if (!entry) {
			logService.warn(`[URI] Flow not found: ${flowId}`);
			vscode.window.showErrorMessage(
				vscode.l10n.t('Flow "{0}" not found. Open the flow gallery to browse available flows.', flowId)
			);
			return;
		}

		// Install to .github/flows/
		const targetFolder = vscode.Uri.joinPath(
			vscode.workspace.workspaceFolders?.[0]?.uri ?? context.globalStorageUri,
			'.github',
			'flows'
		);
		const result = await library.install(entry, targetFolder);

		logService.info(`[URI] Flow installed: ${result.dest.fsPath}`);

		// Open Copilot Chat with the invocation pre-filled
		const chatCommand = `@flow #file:.github/flows/${entry.id}.flow.yaml`;
		await vscode.commands.executeCommand(
			'workbench.action.chat.open',
			{
				query: chatCommand,
				focus: true,
			}
		);

		vscode.window.showInformationMessage(
			vscode.l10n.t('"{0}" installed. Ready to run!', entry.name)
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logService.error(error as Error, `[URI] Install failed: ${message}`);
		if (!message.includes('Installation cancelled')) {
			vscode.window.showErrorMessage(
				vscode.l10n.t('Failed to install flow: {0}', message)
			);
		}
	}
}

export function deactivate() {
	// deactivation logging is best-effort; output channel may already be disposed
}
