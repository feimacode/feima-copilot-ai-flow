/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import {
	BasePromptElementProps,
	PromptElement,
	UserMessage
} from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { IFlowContext } from '../context/flowContextBuilder';
import { FlowTurn } from '../session/flowConversation';
import { ToolCallRound, ToolCalls } from './flowTools';

/**
 * A resolved context file ready to be injected into the prompt as a
 * token-budget-aware priority element.
 */
export interface ContextFile {
	/** Relative path or display label shown as a header in the prompt. */
	readonly label: string;
	/** Full text content of the file. */
	readonly content: string;
}

/**
 * Properties for FlowRolePrompt component
 */
interface FlowRolePromptProps extends BasePromptElementProps {
	/** The role definition */
	readonly roleName: string;
	readonly roleSystemPrompt: string;
	
	/** The user's current query */
	readonly userQuery: string;
	
	/** Current context from VS Code */
	readonly context: IFlowContext;
	
	/** Shared context from prompt.md body */
	readonly sharedContext: string;
	
	/** Previous conversation turns */
	readonly history: ReadonlyArray<FlowTurn>;
	
	/** Maximum number of history turns to include */
	readonly maxHistoryTurns?: number;

	/** Tool call rounds */
	readonly toolCallRounds: ToolCallRound[];

	/** Tool call results */
	readonly toolCallResults: Record<string, vscode.LanguageModelToolResult>;

	/** Tool invocation token */
	readonly toolInvocationToken: vscode.ChatParticipantToolToken | undefined;

	/**
	 * Resolved context files (design guides, architecture docs, security guardrails, etc.).
	 * Rendered at priority 600 — dropped as a unit before conversation history when the
	 * token budget is tight, preserving role instructions and the user query.
	 */
	readonly contextFiles?: ReadonlyArray<ContextFile>;
}

/**
 * Main prompt component for panel role conversations
 * Renders a complete prompt with system message, context, history, and user query
 */
export class FlowRolePrompt extends PromptElement<FlowRolePromptProps> {
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

		// Build a single context block for all reference files at priority 600.
		// The block is omitted entirely when the token budget cannot fit it,
		// which preserves the role instructions (1000) and user query (950) intact.
		const files = this.props.contextFiles;
		const contextBlock = files && files.length > 0
			? (
				<UserMessage priority={600}>
					{'## Reference Context\n\n' +
						files.map(f => `### ${f.label}\n\n${f.content}`).join('\n\n---\n\n')}
				</UserMessage>
			  )
			: undefined;
		
		return (
			<>
				{/* Role instructions and shared context - highest priority */}
				<UserMessage priority={1000}>
					{systemContent}
				</UserMessage>
				
				{/* Current VS Code context - high priority */}
				<FlowContextInfo priority={900} context={this.props.context} />
				
				{/* Context files — lower priority than history; dropped as a unit when budget is tight */}
				{contextBlock}

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
interface FlowContextInfoProps extends BasePromptElementProps {
	readonly context: IFlowContext;
}

class FlowContextInfo extends PromptElement<FlowContextInfoProps> {
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
		
		// Chat references — list the attached file names so the model knows what was provided.
		// File contents are injected separately at a lower priority by the renderer.
		if (context.references && context.references.length > 0) {
			const names = context.references
				.map(r => {
					const v = r.value as unknown;
					if (v instanceof vscode.Uri) { return vscode.workspace.asRelativePath(v, false); }
					if (v && typeof v === 'object' && 'uri' in v && (v as { uri: unknown }).uri instanceof vscode.Uri) {
						return vscode.workspace.asRelativePath((v as { uri: vscode.Uri }).uri, false);
					}
					return null;
				})
				.filter((n): n is string => n !== null);
			if (names.length > 0) {
				parts.push(`Attached files: ${names.join(', ')}`);
			}
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
	readonly history: ReadonlyArray<FlowTurn>;
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
