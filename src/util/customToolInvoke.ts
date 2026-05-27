/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILogger } from '../platform/log/common/logService';

/**
 * Invoke an LM tool from outside a Prompt-TSX rendering cycle.
 *
 * Always passes the supplied `toolInvocationToken` to enable approval dialogs,
 * inline UI, and other session-aware features. Blocked tools are filtered out
 * before reaching this point (see flowEngine.ts).
 */
export async function customInvokeTool(
	toolName: string,
	input: Record<string, unknown>,
	token: vscode.CancellationToken,
	log?: ILogger,
	toolInvocationToken?: vscode.ChatParticipantToolToken
): Promise<vscode.LanguageModelToolResult> {
	// Find the tool
	const tool = vscode.lm.tools.find(t => t.name === toolName);
	
	if (!tool) {
		log?.error(`Tool not found: ${toolName}`);
		return {
			content: [new vscode.LanguageModelTextPart(`Error: Tool '${toolName}' not found`)]
		};
	}
	
	const invocationToken = toolInvocationToken;

	try {
		log?.debug(`Invoking tool ${toolName}${invocationToken ? ' (with session token)' : ''}`);
		
		const result = await vscode.lm.invokeTool(
			toolName,
			{
				input,
				toolInvocationToken: invocationToken,
				tokenizationOptions: {
					tokenBudget: 4000,
					countTokens: async (content: string) => Math.ceil(content.length / 4)
				}
			},
			token
		);
		
		log?.debug(`Tool ${toolName} completed`);
		return result;
		
	} catch (error) {
		log?.error(error instanceof Error ? error : String(error), `Tool ${toolName} invocation failed`);
		
		// Return error as a tool result
		return {
			content: [new vscode.LanguageModelTextPart(`Tool error: ${error instanceof Error ? error.message : String(error)}`)]
		};
	}
}
