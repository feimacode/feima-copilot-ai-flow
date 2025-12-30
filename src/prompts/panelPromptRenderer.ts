/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { renderPrompt } from '@vscode/prompt-tsx';
import { PanelRolePrompt } from './panelRolePrompt';
import { IPanelContext } from '../context/panelContextBuilder';
import { PanelTurn } from '../session/panelConversation';
import { ToolCallRound, ToolResultMetadata } from './panelTools';

/**
 * Service for rendering Prompt-TSX components to VS Code language model messages
 */
export class PanelPromptRenderer {
	
	/**
	 * Render a role prompt using Prompt-TSX and convert to VS Code messages
	 * 
	 * @param roleName Name of the role
	 * @param roleSystemPrompt System prompt for the role
	 * @param userQuery User's current query
	 * @param context Current VS Code context
	 * @param sharedContext Shared context from prompt.md
	 * @param history Previous conversation turns
	 * @param maxTokens Maximum tokens for the prompt
	 * @returns Array of VS Code language model chat messages
	 */
	async renderRolePrompt(
		roleName: string,
		roleSystemPrompt: string,
		userQuery: string,
		context: IPanelContext,
		sharedContext: string,
		history: ReadonlyArray<PanelTurn>,
		maxTokens: number = 8000,
		toolCallRounds: ToolCallRound[] = [],
		toolCallResults: Record<string, vscode.LanguageModelToolResult> = {},
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined = undefined
	): Promise<{ messages: vscode.LanguageModelChatMessage[]; toolCallResults: Record<string, vscode.LanguageModelToolResult> }> {
		
		console.log(`[PanelPromptRenderer] renderRolePrompt called with:`, {
			roleName,
			toolCallRoundsLength: toolCallRounds.length,
			toolCallResultsKeys: Object.keys(toolCallResults),
			hasToolInvocationToken: !!toolInvocationToken
		});

		// Get a language model for tokenization
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
		const model = models.length > 0 ? models[0] : undefined;
		
		if (!model) {
			throw new Error('No language model available for prompt rendering');
		}
		
		console.log(`[PanelPromptRenderer] Calling renderPrompt...`);

		let result;
		try {
			// CRITICAL FIX: prompt-tsx internally calls countMessageTokens() with partially constructed
			// LanguageModelChatMessage objects that have empty content arrays during the rendering phase.
			// The Copilot extension's provideTokenCount implementation tries to access .content properties
			// on these intermediate objects and crashes with "Cannot read properties of undefined".
			// 
			// Solution: Create a custom tokenizer that implements prompt-tsx's ITokenizer interface
			// and handles token counting safely without delegating to the buggy Copilot extension API.
			interface ChatCompletionContentPart {
				type: number;
				text?: string;
			}
			
			const customTokenizer = {
				mode: 2, // OutputMode.VSCode
				// tokenLength is called for individual text parts during rendering
				tokenLength: async (part: ChatCompletionContentPart) => {
					// For text parts, estimate tokens from character count
					if (part.type === 1 && part.text) { // ChatCompletionContentPartKind.Text
						return Math.ceil(part.text.length / 4);
					}
					return 0;
				},
				// countMessageTokens is called with VS Code LanguageModelChatMessage objects
				countMessageTokens: async (message: vscode.LanguageModelChatMessage) => {
					// Estimate tokens from message content
					let totalChars = 0;
					const content = message.content;
					
					if (typeof content === 'string') {
						totalChars = (content as string).length;
					} else if (Array.isArray(content)) {
						for (const part of content) {
							if (part instanceof vscode.LanguageModelTextPart) {
								totalChars += part.value.length;
							}
						}
					}
					
					// Estimate ~4 chars per token + 3 base tokens per message
					return Math.ceil(totalChars / 4) + 3;
				}
			};

			result = await renderPrompt(
				PanelRolePrompt,
				{
					roleName,
					roleSystemPrompt,
					userQuery,
					context,
					sharedContext,
					history,
					maxHistoryTurns: 10,
					toolCallRounds,
					toolCallResults,
					toolInvocationToken
				},
				{ modelMaxPromptTokens: maxTokens },
				customTokenizer as unknown as vscode.LanguageModelChat // Cast to expected type
			);
			console.log(`[PanelPromptRenderer] renderPrompt completed successfully with ${result.messages.length} messages`);
		} catch (error) {
			console.error(`[PanelPromptRenderer] renderPrompt failed:`, error);
			throw error;
		}

		// Extract tool results from metadata
		const newToolCallResults = { ...toolCallResults };
		const toolResultMetadata = result.metadata.getAll(ToolResultMetadata);
		console.log(`[PanelPromptRenderer] Extracted ${toolResultMetadata?.length || 0} tool result metadata entries`);
		if (toolResultMetadata?.length) {
			toolResultMetadata.forEach((meta: ToolResultMetadata) => {
				console.log(`[PanelPromptRenderer] Metadata for ${meta.toolCallId}:`, {
					hasResult: !!meta.result,
					hasContent: meta.result?.content !== undefined,
					isArray: Array.isArray(meta.result?.content),
					contentLength: meta.result?.content?.length
				});
				// Only store valid tool results with content
				if (meta.result && meta.result.content && Array.isArray(meta.result.content)) {
					newToolCallResults[meta.toolCallId] = meta.result;
				} else {
					console.warn(`[PanelPromptRenderer] Skipping invalid tool result for ${meta.toolCallId}`);
				}
			});
		}
		console.log(`[PanelPromptRenderer] Returning ${Object.keys(newToolCallResults).length} tool results`);

		return {
			messages: result.messages,
			toolCallResults: newToolCallResults
		};
	}
	
}
