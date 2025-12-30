/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect } from 'vitest';
import { filterTools, shouldFilterTools } from './toolFilter';
import type * as vscode from 'vscode';

// Mock tool creator
function createMockTool(name: string, description: string = ''): vscode.LanguageModelChatTool {
	return {
		name,
		description,
		inputSchema: { type: 'object', properties: {} }
	} as vscode.LanguageModelChatTool;
}

describe('toolFilter', () => {
	describe('shouldFilterTools', () => {
		it('should return false when tool count is below limit', () => {
			expect(shouldFilterTools(100)).toBe(false);
		});

		it('should return true when tool count exceeds limit', () => {
			expect(shouldFilterTools(129)).toBe(true);
		});

		it('should return false at exactly the limit', () => {
			expect(shouldFilterTools(128)).toBe(false);
		});
	});

	describe('filterTools', () => {
		it('should return all tools when under the limit', () => {
			const tools = [
				createMockTool('tool1'),
				createMockTool('tool2'),
				createMockTool('tool3')
			];
			
			const result = filterTools(tools, 'test query');
			expect(result).toHaveLength(3);
		});

		it('should prioritize core tools', () => {
			const tools = [
				createMockTool('random_tool_1'),
				createMockTool('copilot_createFile'),
				createMockTool('random_tool_2'),
				createMockTool('copilot_readFile'),
				...Array.from({ length: 130 }, (_, i) => createMockTool(`other_tool_${i}`))
			];
			
			const result = filterTools(tools, 'create a file', 128);
			
			// Should include the core tools
			expect(result.find(t => t.name === 'copilot_createFile')).toBeDefined();
			expect(result.find(t => t.name === 'copilot_readFile')).toBeDefined();
		});

		it('should score tools based on query relevance', () => {
			const tools = [
				createMockTool('copilot_createFile', 'Create a new file'),
				createMockTool('copilot_readFile', 'Read an existing file'),
				createMockTool('copilot_deleteFile', 'Delete a file'),
				...Array.from({ length: 130 }, (_, i) => createMockTool(`unrelated_tool_${i}`, 'Unrelated tool'))
			];
			
			const result = filterTools(tools, 'create a new file', 128);
			
			// createFile should be included due to query relevance
			expect(result.find(t => t.name === 'copilot_createFile')).toBeDefined();
		});

		it('should handle query with file operations', () => {
			const tools = [
				createMockTool('copilot_createFile'),
				createMockTool('copilot_replaceString'),
				createMockTool('copilot_readFile'),
				createMockTool('terminal_tool'),
				...Array.from({ length: 130 }, (_, i) => createMockTool(`tool_${i}`))
			];
			
			const result = filterTools(tools, 'read and modify files', 128);
			
			// File operation tools should be prioritized
			expect(result.find(t => t.name === 'copilot_readFile')).toBeDefined();
			expect(result.find(t => t.name === 'copilot_replaceString')).toBeDefined();
		});

		it('should respect maxTools parameter', () => {
			const tools = Array.from({ length: 200 }, (_, i) => 
				createMockTool(`tool_${i}`)
			);
			
			const result = filterTools(tools, 'test', 50);
			expect(result.length).toBeLessThanOrEqual(50);
		});

		it('should include all core tools even with small maxTools', () => {
			const coreTools = [
				'copilot_readFile',
				'copilot_createFile',
				'copilot_replaceString',
			].map(name => createMockTool(name));
			
			const otherTools = Array.from({ length: 100 }, (_, i) => 
				createMockTool(`other_${i}`)
			);
			
			const allTools = [...coreTools, ...otherTools];
			const result = filterTools(allTools, 'test', 128);
			
			// All core tools should be present
			coreTools.forEach(coreTool => {
				expect(result.find(t => t.name === coreTool.name)).toBeDefined();
			});
		});
	});
});
