/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

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
	token: vscode.CancellationToken
): Promise<vscode.LanguageModelToolResult> {
	// Find the tool
	const tool = vscode.lm.tools.find(t => t.name === toolName);
	
	if (!tool) {
		console.error(`[customInvokeTool] Tool not found: ${toolName}`);
		return {
			content: [new vscode.LanguageModelTextPart(`Error: Tool '${toolName}' not found`)]
		};
	}
	
	try {
		console.log(`[customInvokeTool] Invoking tool ${toolName} without toolInvocationToken`);
		
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
		
		console.log(`[customInvokeTool] Tool ${toolName} completed successfully`);
		return result;
		
	} catch (error) {
		console.error(`[customInvokeTool] Tool ${toolName} invocation failed:`, error);
		
		// Return error as a tool result
		return {
			content: [new vscode.LanguageModelTextPart(`Tool error: ${error instanceof Error ? error.message : String(error)}`)]
		};
	}
}
