/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILogger } from '../platform/log/common/logService';

/**
 * Hard limit on number of tools that can be sent to the LLM
 * This matches the limit in vscode-copilot-chat extension
 */
const HARD_TOOL_LIMIT = 128;

/**
 * Core tools that should always be included (highest priority)
 */
const CORE_TOOLS = new Set([
	'copilot_readFile',
	'copilot_createFile',
	'copilot_replaceString',
	'copilot_multiReplaceString',
	'copilot_listDirectory',
	'copilot_findTextInFiles',
	'copilot_findFiles',
	'copilot_searchCodebase',
	'copilot_applyPatch',
	'copilot_insertEdit',
	'run_in_terminal',
	'get_terminal_output',
	'manage_todo_list',
	'create_directory',
	'copilot_readProjectStructure',
	'runSubagent',
	'copilot_memory'
]);

/**
 * Score tool relevance to the query
 */
function scoreToolRelevance(tool: vscode.LanguageModelChatTool, query: string): number {
	const queryLower = query.toLowerCase();
	const toolNameLower = tool.name.toLowerCase();
	const descLower = tool.description?.toLowerCase() || '';
	
	let score = 0;
	
	// Exact name match
	if (queryLower.includes(toolNameLower)) {
		score += 10;
	}
	
	// Core tools get bonus
	if (CORE_TOOLS.has(tool.name)) {
		score += 5;
	}
	
	// File operations keywords
	if (queryLower.includes('create') || queryLower.includes('file') ||
		queryLower.includes('write') || queryLower.includes('save')) {
		if (toolNameLower.includes('create') || toolNameLower.includes('file') ||
			toolNameLower.includes('write')) {
			score += 8;
		}
	}
	
	// Read operations
	if (queryLower.includes('read') || queryLower.includes('show') ||
		queryLower.includes('display') || queryLower.includes('get')) {
		if (toolNameLower.includes('read') || toolNameLower.includes('get') ||
			toolNameLower.includes('list')) {
			score += 6;
		}
	}
	
	// Edit operations
	if (queryLower.includes('edit') || queryLower.includes('modify') ||
		queryLower.includes('change') || queryLower.includes('update') ||
		queryLower.includes('replace')) {
		if (toolNameLower.includes('replace') || toolNameLower.includes('edit') ||
			toolNameLower.includes('apply') || toolNameLower.includes('insert')) {
			score += 7;
		}
	}
	
	// Search operations
	if (queryLower.includes('search') || queryLower.includes('find')) {
		if (toolNameLower.includes('search') || toolNameLower.includes('find') ||
			toolNameLower.includes('grep')) {
			score += 6;
		}
	}
	
	// Terminal operations
	if (queryLower.includes('terminal') || queryLower.includes('command') ||
		queryLower.includes('run') || queryLower.includes('execute')) {
		if (toolNameLower.includes('terminal') || toolNameLower.includes('run')) {
			score += 6;
		}
	}
	
	// Test operations
	if (queryLower.includes('test')) {
		if (toolNameLower.includes('test')) {
			score += 5;
		}
	}
	
	// Description match
	if (descLower) {
		const queryWords = queryLower.split(/\s+/);
		for (const word of queryWords) {
			if (word.length > 3 && descLower.includes(word)) {
				score += 1;
			}
		}
	}
	
	return score;
}

/**
 * Smart tool filtering that prioritizes important tools and limits total count
 * 
 * This is a lightweight version inspired by vscode-copilot-chat's virtual tool grouping.
 * It ensures critical tools like copilot_createFile are always included.
 */
export function filterTools(
	allTools: vscode.LanguageModelChatTool[],
	query: string,
	maxTools: number = HARD_TOOL_LIMIT,
	log?: ILogger
): vscode.LanguageModelChatTool[] {
	if (allTools.length <= maxTools) {
		return allTools;
	}
	
	log?.debug(`Filtering ${allTools.length} tools down to ${maxTools}`);
	
	// Separate core tools and others
	const coreTools: vscode.LanguageModelChatTool[] = [];
	const otherTools: vscode.LanguageModelChatTool[] = [];
	
	for (const tool of allTools) {
		if (CORE_TOOLS.has(tool.name)) {
			coreTools.push(tool);
		} else {
			otherTools.push(tool);
		}
	}
	
	log?.debug(`Core tools: ${coreTools.length}, Other tools: ${otherTools.length}`);
	
	// Always include all core tools if they fit
	const result: vscode.LanguageModelChatTool[] = [];
	
	if (coreTools.length <= maxTools) {
		result.push(...coreTools);
		const remainingSlots = maxTools - coreTools.length;
		
		// Score and sort other tools by relevance
		const scoredTools = otherTools.map(tool => ({
			tool,
			score: scoreToolRelevance(tool, query)
		}));
		
		scoredTools.sort((a, b) => b.score - a.score);
		
		// Add top-scored tools up to the limit
		for (let i = 0; i < Math.min(remainingSlots, scoredTools.length); i++) {
			result.push(scoredTools[i].tool);
		}
		
		log?.debug(`Selected ${result.length} tools: ${coreTools.length} core + ${result.length - coreTools.length} others`);
	} else {
		// If even core tools exceed the limit (shouldn't happen), just take the first maxTools
		result.push(...coreTools.slice(0, maxTools));
		log?.warn(`Core tools alone (${coreTools.length}) exceed limit (${maxTools})`);
	}
	
	// Log which important tools made it
	const importantToolsIncluded = result
		.filter(t => CORE_TOOLS.has(t.name))
		.map(t => t.name);
	log?.debug(`Important tools included: ${importantToolsIncluded.join(', ')}`);
	
	return result;
}

/**
 * Check if tool filtering is needed
 */
export function shouldFilterTools(toolCount: number): boolean {
	return toolCount > HARD_TOOL_LIMIT;
}
