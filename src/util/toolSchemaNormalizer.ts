/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Normalizes tool schemas to avoid "object schema missing properties" error from Copilot API.
 * 
 * This fixes a common issue where MCP tools don't have a `properties` object in their schema,
 * which causes the Copilot extension to reject them with:
 * "Invalid schema for function 'xxx': In context=(), object schema missing properties."
 * 
 * The fix ensures all tools have:
 * - type: 'object' at the root level
 * - a 'properties' object (even if empty)
 */
export function normalizeToolSchemas(tools: vscode.LanguageModelChatTool[]): vscode.LanguageModelChatTool[] {
	if (!tools || tools.length === 0) {
		return tools;
	}

	return tools.map(tool => {
		// If tool doesn't have inputSchema, nothing to normalize
		if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
			return tool;
		}

		interface ToolSchema {
			type?: string;
			properties?: Record<string, unknown>;
			[key: string]: unknown;
		}
		
		const schema = tool.inputSchema as ToolSchema;
		let needsNormalization = false;

		// Check if schema needs normalization
		if (schema.type !== 'object') {
			needsNormalization = true;
		}

		if (!schema.properties || typeof schema.properties !== 'object') {
			needsNormalization = true;
		}

		// If no normalization needed, return original tool
		if (!needsNormalization) {
			return tool;
		}

		// Create normalized schema
		const normalizedSchema = {
			...schema,
			type: 'object',
			properties: schema.properties || {}
		};


		// Return tool with normalized schema
		// Note: We can't modify the tool object directly, so we create a new object
		// that looks like the original but with our normalized schema
		return {
			...tool,
			inputSchema: normalizedSchema
		} as vscode.LanguageModelChatTool;
	});
}
