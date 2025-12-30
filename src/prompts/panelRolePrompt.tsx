/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import {
	BasePromptElementProps,
	PromptElement,
	SystemMessage,
	UserMessage
} from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { IPanelContext } from '../context/panelContextBuilder';
import { PanelTurn } from '../session/panelConversation';
import { ToolCallRound, ToolCalls } from './panelTools';

/**
 * Properties for PanelRolePrompt component
 */
interface PanelRolePromptProps extends BasePromptElementProps {
	/** The role definition */
	readonly roleName: string;
	readonly roleSystemPrompt: string;
	
	/** The user's current query */
	readonly userQuery: string;
	
	/** Current context from VS Code */
	readonly context: IPanelContext;
	
	/** Shared context from prompt.md body */
	readonly sharedContext: string;
	
	/** Previous conversation turns */
	readonly history: ReadonlyArray<PanelTurn>;
	
	/** Maximum number of history turns to include */
	readonly maxHistoryTurns?: number;

	/** Tool call rounds */
	readonly toolCallRounds: ToolCallRound[];

	/** Tool call results */
	readonly toolCallResults: Record<string, vscode.LanguageModelToolResult>;

	/** Tool invocation token */
	readonly toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
}

/**
 * Main prompt component for panel role conversations
 * Renders a complete prompt with system message, context, history, and user query
 */
export class PanelRolePrompt extends PromptElement<PanelRolePromptProps> {
	render() {
		const maxTurns = this.props.maxHistoryTurns ?? 5;
		const recentHistory = this.props.history.slice(-maxTurns);
		
		// Build system message content as pure string
		const hasWorkspaceFolders = this.props.context.workspace?.folders && this.props.context.workspace.folders.length > 0;
		
		let systemContent = `${this.props.roleSystemPrompt}\n\nShared Context:\n${this.props.sharedContext}`;
		
		if (hasWorkspaceFolders) {
			const folders = this.props.context.workspace!.folders!;
			systemContent += `\n\nIMPORTANT - Tool Usage Guidelines:\nWhen using tools like copilot_listDirectory or copilot_readFile:\n- ALWAYS use absolute paths (never relative paths like "." or "..")\n- Workspace root folders: ${folders.join(', ')}\n- Example: Use "${folders[0]}/src" instead of "src" or "./src"\n- Tools will reject relative paths with an error`;
		}
		
		console.log('[PanelRolePrompt] systemContent length:', systemContent.length);
		console.log('[PanelRolePrompt] systemContent preview:', systemContent.substring(0, 100));
		console.log('[PanelRolePrompt] userQuery:', this.props.userQuery);
		
		return (
			<>
				{/* System message with role definition - highest priority */}
				<SystemMessage priority={1000}>
					{systemContent}
				</SystemMessage>
				
				{/* Current VS Code context - high priority */}
				<PanelContextInfo priority={900} context={this.props.context} />
				
				{/* Conversation history - medium priority */}
				<ConversationHistory 
					priority={700} 
					history={recentHistory} 
					currentRole={this.props.roleName}
				/>
				
				{/* User query - highest priority for user messages */}
				<UserMessage priority={950}>
					{this.props.userQuery}
				</UserMessage>

				{/* Tool calls and results */}
				<ToolCalls
					toolCallRounds={this.props.toolCallRounds}
					toolInvocationToken={this.props.toolInvocationToken}
					toolCallResults={this.props.toolCallResults} 
				/>
			</>
		);
	}
}

/**
 * Component for rendering VS Code context information
 */
interface PanelContextInfoProps extends BasePromptElementProps {
	readonly context: IPanelContext;
}

class PanelContextInfo extends PromptElement<PanelContextInfoProps> {
	render() {
		const { context } = this.props;
		const parts: string[] = [];
		
		// Active editor info
		if (context.activeEditor) {
			const editor = context.activeEditor;
			parts.push(
				`Active File: ${editor.fileName} (${editor.languageId})`,
				`Line Count: ${editor.lineCount}`,
				`Selection: Lines ${editor.selection.start.line + 1}-${editor.selection.end.line + 1}`
			);
		}
		
		// Workspace info
		if (context.workspace) {
			parts.push(`Workspace: ${context.workspace.name || 'Unknown'}`);
			if (context.workspace.folders && context.workspace.folders.length > 0) {
				parts.push(`Workspace Folders:`);
				context.workspace.folders.forEach(folder => {
					parts.push(`  - ${folder}`);
				});
			}
		}
		
		// Diagnostics (errors/warnings)
		if (context.diagnostics && context.diagnostics.length > 0) {
			const errorCount = context.diagnostics.filter(d => d.severity === 0).length;
			const warningCount = context.diagnostics.filter(d => d.severity === 1).length;
			if (errorCount > 0 || warningCount > 0) {
				parts.push(`Diagnostics: ${errorCount} errors, ${warningCount} warnings`);
			}
		}
		
		// Chat references
		if (context.references && context.references.length > 0) {
			parts.push(`References: ${context.references.length} items`);
		}
		
		if (parts.length === 0) {
			return undefined;
		}
		
		// Build content as pure string
		const content = `Current Context:\n${parts.join('\n')}`;
		
		return (
			<UserMessage>
				{content}
			</UserMessage>
		);
	}
}

/**
 * Component for rendering conversation history
 */
interface ConversationHistoryProps extends BasePromptElementProps {
	readonly history: ReadonlyArray<PanelTurn>;
	readonly currentRole: string;
}

class ConversationHistory extends PromptElement<ConversationHistoryProps> {
	render() {
		const { history, currentRole } = this.props;
		
		if (history.length === 0) {
			return undefined;
		}
		
		const historyParts: string[] = [];
		for (const turn of history) {
			const myResponse = turn.responses.get(currentRole);
			historyParts.push(`\nQuery: ${turn.query}`);
			if (myResponse) {
				historyParts.push(`My Response: ${myResponse}`);
			}
			for (const [role, response] of turn.responses.entries()) {
				if (role !== currentRole) {
					historyParts.push(`${role}: ${response}`);
				}
			}
		}
		
		// Build content as pure string
		const content = `Previous Discussion:\n${historyParts.join('\n')}`;
		
		return (
			<UserMessage>
				{content}
			</UserMessage>
		);
	}
}
