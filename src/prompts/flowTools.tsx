/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import {
	AssistantMessage,
	BasePromptElementProps,
	Chunk,
	PromptElement,
	PromptMetadata,
	PromptPiece,
	PromptSizing,
	ToolCall,
	ToolMessage,
	UserMessage
} from '@vscode/prompt-tsx';
import { ToolResult } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as vscode from 'vscode';

export interface ToolCallRound {
	response: string;
	toolCalls: vscode.LanguageModelToolCallPart[];
}

export interface ToolCallsProps extends BasePromptElementProps {
	toolCallRounds: ToolCallRound[];
	toolCallResults: Record<string, vscode.LanguageModelToolResult>;
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
}

const dummyCancellationToken: vscode.CancellationToken = new vscode.CancellationTokenSource().token;

/**
 * Render a set of tool calls, which look like an AssistantMessage with a set of tool calls followed by the associated UserMessages containing results.
 */
export class ToolCalls extends PromptElement<ToolCallsProps, void> {
	async render(_state: void, _sizing: PromptSizing) {
		if (!this.props.toolCallRounds.length) {
			return undefined;
		}

		// Note- for the copilot models, the final prompt must end with a non-tool-result UserMessage
		return <>
			{this.props.toolCallRounds.map(round => this.renderOneToolCallRound(round))}
			<UserMessage>Above is the result of calling one or more tools. The user cannot see the results, so you should explain them to the user if referencing them in your answer.</UserMessage>
		</>;
	}

	private renderOneToolCallRound(round: ToolCallRound) {
		const assistantToolCalls: ToolCall[] = round.toolCalls.map(tc => ({ type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input) }, id: tc.callId }));
		return (
			<Chunk>
				<AssistantMessage toolCalls={assistantToolCalls}>{round.response}</AssistantMessage>
				{round.toolCalls.map(toolCall =>
					<ToolResultElement toolCall={toolCall} toolInvocationToken={this.props.toolInvocationToken} toolCallResult={this.props.toolCallResults[toolCall.callId]} />)}
			</Chunk>);
	}
}

interface ToolResultElementProps extends BasePromptElementProps {
	toolCall: vscode.LanguageModelToolCallPart;
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
	toolCallResult: vscode.LanguageModelToolResult | undefined;
}

/**
 * One tool call result, which either comes from the cache or from invoking the tool.
 */
class ToolResultElement extends PromptElement<ToolResultElementProps, void> {
	async render(state: void, sizing: PromptSizing): Promise<PromptPiece | undefined> {
		const tool = vscode.lm.tools.find(t => t.name === this.props.toolCall.name);
		if (!tool) {
			console.error(`Tool not found: ${this.props.toolCall.name}`);
			return <ToolMessage toolCallId={this.props.toolCall.callId}>Tool not found</ToolMessage>;
		}

		const tokenizationOptions: vscode.LanguageModelToolTokenizationOptions = {
			tokenBudget: sizing.tokenBudget,
			countTokens: async (content: string) => sizing.countTokens(content),
		};

		console.log(`[ToolResultElement] Rendering tool ${this.props.toolCall.name}`);
		console.log(`[ToolResultElement] - Cached result available:`, this.props.toolCallResult ? 'yes' : 'no');
		console.log(`[ToolResultElement] - toolInvocationToken:`, this.props.toolInvocationToken ? 'present' : 'undefined');
		
		let toolResult: vscode.LanguageModelToolResult | undefined = this.props.toolCallResult;
		
		if (!toolResult) {
			console.log(`[ToolResultElement] Invoking tool ${this.props.toolCall.name}`);
			
			// Handle file creation tools directly using VS Code API
			// This bypasses the "Invalid stream" error from vscode.lm.invokeTool
			if (this.props.toolCall.name === 'copilot_createFile' || this.props.toolCall.name === 'create_file') {
				try {
					const input = this.props.toolCall.input as { filePath?: string; content?: string };
					if (!input.filePath || !input.content) {
						throw new Error('Missing filePath or content parameter');
					}
					
					const fileUri = vscode.Uri.file(input.filePath);
					const fileContent = new TextEncoder().encode(input.content);
					
					await vscode.workspace.fs.writeFile(fileUri, fileContent);
					
					toolResult = {
						content: [new vscode.LanguageModelTextPart(`File created successfully: ${input.filePath}`)]
					};
					console.log(`[ToolResultElement] File created: ${input.filePath}`);
				} catch (error) {
					console.error(`[ToolResultElement] File creation failed:`, error);
					const fallbackResult: vscode.LanguageModelToolResult = {
						content: [new vscode.LanguageModelTextPart(`File creation error: ${error instanceof Error ? error.message : String(error)}`)]
					};
					return (
						<ToolMessage toolCallId={this.props.toolCall.callId}>
							<meta value={new ToolResultMetadata(this.props.toolCall.callId, fallbackResult)}></meta>
							File creation error: {error instanceof Error ? error.message : String(error)}
						</ToolMessage>
					);
				}
			} else {
				// For other tools, use vscode.lm.invokeTool without toolInvocationToken
				// to avoid "Invalid stream" errors
				try {
					toolResult = await vscode.lm.invokeTool(
						this.props.toolCall.name,
						{ 
							input: this.props.toolCall.input, 
							toolInvocationToken: undefined, 
							tokenizationOptions 
						},
						dummyCancellationToken
					);
					console.log(`[ToolResultElement] Tool ${this.props.toolCall.name} invocation completed`);
				} catch (error) {
					console.error(`[ToolResultElement] Tool ${this.props.toolCall.name} invocation threw error:`, error);
					const fallbackResult: vscode.LanguageModelToolResult = {
						content: [new vscode.LanguageModelTextPart(`Tool error: ${error instanceof Error ? error.message : String(error)}`)]
					};
					return (
						<ToolMessage toolCallId={this.props.toolCall.callId}>
							<meta value={new ToolResultMetadata(this.props.toolCall.callId, fallbackResult)}></meta>
							Tool error: {String(error)}
						</ToolMessage>
					);
				}
			}
		}

		console.log(`[ToolResultElement] Tool ${this.props.toolCall.name} result structure:`, {
			toolResultDefined: !!toolResult,
			hasContent: toolResult?.content !== undefined,
			contentIsArray: Array.isArray(toolResult?.content),
			contentLength: toolResult?.content?.length,
			contentTypes: toolResult?.content?.map(c => c?.constructor?.name)
		});

		// Validate tool result before using it
		if (!toolResult || !toolResult.content || !Array.isArray(toolResult.content) || toolResult.content.length === 0) {
			console.error(`[ToolResultElement] Tool ${this.props.toolCall.name} returned invalid result, using fallback`);
			const fallbackResult: vscode.LanguageModelToolResult = {
				content: [new vscode.LanguageModelTextPart('Tool returned no result')]
			};
			return (
				<ToolMessage toolCallId={this.props.toolCall.callId}>
					<meta value={new ToolResultMetadata(this.props.toolCall.callId, fallbackResult)}></meta>
					Tool returned no result
				</ToolMessage>
			);
		}

		console.log(`[ToolResultElement] Creating ToolMessage with valid result for ${this.props.toolCall.name}`);
		return (
			<ToolMessage toolCallId={this.props.toolCall.callId}>
				<meta value={new ToolResultMetadata(this.props.toolCall.callId, toolResult)}></meta>
				<ToolResult data={toolResult} />
			</ToolMessage>
		);
	}
}

export class ToolResultMetadata extends PromptMetadata {
	constructor(
		public toolCallId: string,
		public result: vscode.LanguageModelToolResult,
	) {
		super();
	}
}
