/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { FlowPromptRenderer } from './flowPromptRenderer';
import { IFlowContext } from '../context/flowContextBuilder';

describe('FlowPromptRenderer', () => {
	let renderer: FlowPromptRenderer;
	
	beforeEach(() => {
		renderer = new FlowPromptRenderer();
	});
	
	describe('renderRolePrompt', () => {
		it('should render with minimal context (no workspace, empty arrays)', async () => {
			const context: IFlowContext = {
				activeEditor: undefined,
				workspace: undefined,
				diagnostics: [],
				references: []
			};
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do?',
				context,
				'Shared context here.',
				[],
				[],
				8000,
				[],
				{},
				undefined
			);
			
			// Should succeed without errors
			expect(result).toBeDefined();
			expect(result.messages).toBeDefined();
			expect(result.messages.length).toBeGreaterThan(0);
			
			// Validate all messages have proper content
			for (const msg of result.messages) {
				expect(msg).toBeDefined();
				expect(msg.content).toBeDefined();
				expect(msg.content).not.toBe(null);
				expect(msg.content).not.toBe(undefined);
			}
		});
		
		it('should render with workspace folders', async () => {
			const context: IFlowContext = {
				activeEditor: undefined,
				workspace: {
					name: 'Test Workspace',
					folders: ['/home/user/project', '/home/user/project2']
				},
				diagnostics: [],
				references: []
			};
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do?',
				context,
				'Shared context here.',
				[],
				[],
				8000,
				[],
				{},
				undefined
			);
			
			expect(result).toBeDefined();
			expect(result.messages).toBeDefined();
			
			// In VS Code mode, SystemMessage might not be included or converted differently
			// Just verify we have messages and they have content
			expect(result.messages.length).toBeGreaterThan(0);
			
			// Find a message with Tool Usage Guidelines (should be in context info or system)
			const msgWithGuidelines = result.messages.find((m: vscode.LanguageModelChatMessage) => {
				const content = m.content;
				const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
				return contentStr.includes('Tool Usage Guidelines');
			});
			expect(msgWithGuidelines).toBeDefined();
		});
		
		it('should render with active editor context', async () => {
			const context: IFlowContext = {
				activeEditor: {
					uri: vscode.Uri.file('/home/user/project/test.ts'),
					fileName: '/home/user/project/test.ts',
					languageId: 'typescript',
					selection: {
						start: { line: 10, character: 0 },
						end: { line: 15, character: 20 }
				} as vscode.Selection,
					lineCount: 100
				},
				workspace: {
					name: 'Test Workspace',
					folders: ['/home/user/project']
				},
				diagnostics: [],
				references: []
			};
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do?',
				context,
				'Shared context here.',
				[],
				[],
				8000,
				[],
				{},
				undefined
			);
			
			expect(result).toBeDefined();
			expect(result.messages).toBeDefined();
			
			// Should include editor context in user message
			const userMsgs = result.messages.filter(m => 
				m.role === 1 // User role
			);
			expect(userMsgs.length).toBeGreaterThan(0);
			
			// At least one user message should contain context info
			const hasEditorContext = userMsgs.some(m => {
				const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
				return content.includes('Active File') && content.includes('test.ts');
			});
			expect(hasEditorContext).toBe(true);
		});
		
		it('should handle empty workspace folders gracefully', async () => {
			const context: IFlowContext = {
				activeEditor: undefined,
				workspace: {
					name: 'Test',
					folders: [] // Empty array
				},
				diagnostics: [],
				references: []
			};
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do?',
				context,
				'Shared context here.',
				[],
				[],
				8000,
				[],
				{},
				undefined
			);
			
			expect(result).toBeDefined();
			expect(result.messages).toBeDefined();
			
			// Verify messages exist
			expect(result.messages.length).toBeGreaterThan(0);
			
			// Should NOT include tool usage guidelines when no workspace folders
			const allContent = result.messages.map((m: vscode.LanguageModelChatMessage) => {
				const content = m.content;
				return typeof content === 'string' ? content : JSON.stringify(content);
			}).join(' ');
			expect(allContent).not.toContain('Tool Usage Guidelines');
		});
		
		it('should handle conversation history', async () => {
			const context: IFlowContext = {
				activeEditor: undefined,
				workspace: undefined,
				diagnostics: [],
				references: []
			};
			
			const history = [
				{
					id: 'turn-1',
					query: 'Previous question?',
					context: context,
					timestamp: new Date(),
					responses: new Map([
						['TestRole', 'My previous response'],
						['OtherRole', 'Other role response']
					])
				}
			];
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do now?',
				context,
				'Shared context here.',
				[],
				history,
				8000,
				[],
				{},
				undefined
			);
			
			expect(result).toBeDefined();
			expect(result.messages).toBeDefined();
			
			// Should include history in user messages
			const userMsgs = result.messages.filter(m => 
				m.role === 1 // User role
			);
			
			const hasHistory = userMsgs.some(m => {
				const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
				return content.includes('Previous Discussion') && 
					content.includes('Previous question?');
			});
			expect(hasHistory).toBe(true);
		});
		
		it('should not include empty components in messages', async () => {
			const context: IFlowContext = {
				activeEditor: undefined,
				workspace: undefined,
				diagnostics: [],
				references: []
			};
			
			const result = await renderer.renderRolePrompt(
				'TestRole',
				'You are a test role.',
				'What should we do?',
				context,
				'Shared context here.',
				[], // contextFiles
				[], // No history
				8000,
				[],
				{},
				undefined
			);
			
			// All messages should have valid non-empty content
			for (const msg of result.messages) {
				const content = msg.content;
				
				if (typeof content === 'string') {
				expect((content as string).length).toBeGreaterThan(0);
				} else if (Array.isArray(content)) {
					expect(content.length).toBeGreaterThan(0);
				} else {
					// Content should be either string or array
					expect(content).toBeDefined();
				}
			}
		});
	});
});
