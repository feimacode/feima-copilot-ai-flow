/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILogger } from '../platform/log/common/logService';

/**
 * Custom tool invocation that bypasses toolInvocationToken to avoid "Invalid stream" errors.
 * 
 * This is a workaround for https://github.com/microsoft/vscode/issues/255855
 * VS Code's built-in invokeTool has strict requirements about stream context that don't work
 * in nested tool-calling loops. This function calls vscode.lm.invokeTool without the token.
 */
export async function customInvokeTool(
	toolName: string,
	input: Record<string, unknown>,
	token: vscode.CancellationToken,
	log?: ILogger
): Promise<vscode.LanguageModelToolResult> {
	// Find the tool
	const tool = vscode.lm.tools.find(t => t.name === toolName);
	
	if (!tool) {
		log?.error(`Tool not found: ${toolName}`);
		return {
			content: [new vscode.LanguageModelTextPart(`Error: Tool '${toolName}' not found`)]
		};
	}
	
	try {
		log?.debug(`Invoking tool ${toolName}`);
		
		// Call vscode.lm.invokeTool without toolInvocationToken
		// This avoids "Invalid stream" errors but means no inline UI progress
		const result = await vscode.lm.invokeTool(
			toolName,
			{
				input,
				toolInvocationToken: undefined, // Critical: avoid stream validation errors
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
