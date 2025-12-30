/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotCliExecutor } from './copilotCliExecutor';
import * as vscode from 'vscode';
import type { IPanelContext } from '../context/panelContextBuilder';
import type { PanelTurn } from '../session/panelConversation';

// Mock dependencies
vi.mock('./cliSpawner', () => ({
	findInPath: vi.fn(),
	spawnProcess: vi.fn()
}));

describe('CopilotCliExecutor', () => {
	let executor: CopilotCliExecutor;
	let mockContext: IPanelContext;
	let mockHistory: PanelTurn[];
	
	beforeEach(() => {
		vi.clearAllMocks();
		executor = new CopilotCliExecutor();
		
		// Create mock context
		mockContext = {
			activeEditor: {
				uri: vscode.Uri.file('/test/file.ts'),
				fileName: 'file.ts',
				languageId: 'typescript',
				selection: new vscode.Range(0, 0, 0, 0),
				lineCount: 10
			},
			workspace: {
				folders: ['/workspace/folder1'],
				name: 'test-workspace'
			},
			diagnostics: [],
			references: []
		};
		
		// Create mock history
		mockHistory = [
			{
				id: '1',
				timestamp: new Date(),
				query: 'Previous question',
				context: mockContext,
				responses: new Map([
					['Developer', 'Previous developer response'],
					['QA', 'Previous QA response']
				])
			} as PanelTurn
		];
	});
	
	describe('checkAvailability', () => {
		it('should return available when gh CLI is found and authenticated', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess).mockResolvedValue({
				stdout: 'Logged in',
				stderr: '',
				exitCode: 0
			});
			
			const result = await executor.checkAvailability();
			
			expect(result.available).toBe(true);
			expect(result.error).toBeUndefined();
		});
		
		it('should return error when gh CLI not found', async () => {
			const { findInPath } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue(undefined);
			
			const result = await executor.checkAvailability();
			
			expect(result.available).toBe(false);
			expect(result.error).toContain('not found in PATH');
		});
		
		it('should return error when gh CLI not authenticated', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess).mockResolvedValue({
				stdout: '',
				stderr: 'Not logged in',
				exitCode: 1
			});
			
			const result = await executor.checkAvailability();
			
			expect(result.available).toBe(false);
			expect(result.error).toContain('not authenticated');
		});
	});
	
	describe('isAuthenticated', () => {
		it('should return true when authentication succeeds', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess).mockResolvedValue({
				stdout: 'Logged in',
				stderr: '',
				exitCode: 0
			});
			
			const result = await executor.isAuthenticated();
			
			expect(result).toBe(true);
		});
		
		it('should return false when authentication fails', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess).mockResolvedValue({
				stdout: '',
				stderr: 'Not authenticated',
				exitCode: 1
			});
			
			const result = await executor.isAuthenticated();
			
			expect(result).toBe(false);
		});
		
		it('should return false when gh CLI not found', async () => {
			const { findInPath } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue(undefined);
			
			const result = await executor.isAuthenticated();
			
			expect(result).toBe(false);
		});
	});
	
	describe('executeCopilotCli', () => {
		it('should build prompt with role and context', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" }) // auth check
				.mockResolvedValueOnce({
					stdout: 'CLI response text',
					stderr: '',
					exitCode: 0
				}); // actual execution
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'You are a senior developer',
				userQuery: 'How should we implement this feature?',
				context: mockContext,
				sharedContext: 'Shared project context'
			});
			
			expect(result.roleName).toBe('Developer');
			expect(result.content).toBe('CLI response text');
			expect(result.model).toBe('gh-copilot-cli');
			expect(result.error).toBeUndefined();
			
			// Verify spawn was called with correct arguments
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const executionCall = spawnCalls[1];
			expect(executionCall[0]).toBe('/usr/bin/gh');
			expect(executionCall[1]).toEqual(['copilot', 'suggest', '-p', expect.any(String)]);
		});
		
		it('should include conversation history in prompt', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: 'Response with history context',
					stderr: '',
					exitCode: 0
				});
			
			await executor.executeCopilotCli({
				roleName: 'QA',
				systemPrompt: 'You are a QA engineer',
				userQuery: 'What tests should we add?',
				context: mockContext,
				history: mockHistory
			});
			
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const executionCall = spawnCalls[1];
			const prompt = executionCall[1][3]; // The -p argument value
			
			expect(prompt).toContain('Previous question');
			expect(prompt).toContain('Previous developer response');
		});
		
		it('should strip ANSI codes from output', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: '\x1B[32mGreen text\x1B[0m normal text',
					stderr: '',
					exitCode: 0
				});
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test query',
				context: mockContext
			});
			
			expect(result.content).toBe('Green text normal text');
			expect(result.content).not.toContain('\x1B');
		});
		
		it('should set NO_COLOR environment variables', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: 'Response',
					stderr: '',
					exitCode: 0
				});
			
			await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const executionCall = spawnCalls[1];
			const options = executionCall[2];
			
			expect(options?.env).toMatchObject({
				NO_COLOR: '1',
				CLICOLOR: '0',
				CLICOLOR_FORCE: '0'
			});
		});
		
		it('should handle CLI execution errors', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: '',
					stderr: 'CLI error message',
					exitCode: 1
				});
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			expect(result.error).toBeDefined();
			expect(result.error).toContain('exited with code 1');
			expect(result.content).toBe('');
		});
		
		it('should handle timeout errors', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockRejectedValueOnce(new Error('Process timed out after 60000ms'));
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			expect(result.error).toContain('timed out');
		});
		
		it('should handle cancellation', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			const cancellationTokenSource = new vscode.CancellationTokenSource();
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockRejectedValueOnce(new vscode.CancellationError());
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext,
				token: cancellationTokenSource.token
			});
			
			expect(result.error).toBeDefined();
			expect(result.error).toContain('cancelled');
		});
		
		it('should call onProgress callback', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			const onProgress = vi.fn();
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
				.mockImplementation((cmd: string, args: string[], options?: { onStdout?: (data: string) => void }) => {
					// Simulate streaming output
					if (options?.onStdout) {
						options.onStdout('Chunk 1');
						options.onStdout('Chunk 2');
					}
					return Promise.resolve({
						stdout: 'Final output',
						stderr: '',
						exitCode: 0
					});
				});
			
			await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext,
				onProgress
			});
			
			expect(onProgress).toHaveBeenCalled();
		});
		
		it('should handle empty CLI output', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: '   ',
					stderr: '',
					exitCode: 0
				});
			
			const result = await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			expect(result.error).toContain('empty output');
		});
	});
	
	describe('prompt building', () => {
		it('should include workspace folders when present', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: 'Response',
					stderr: '',
					exitCode: 0
				});
			
			await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const prompt = spawnCalls[1][1][3];
			
			expect(prompt).toContain('# Workspace');
			expect(prompt).toContain('/workspace/folder1');
		});
		
		it('should include active file when present', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: 'Response',
					stderr: '',
					exitCode: 0
				});
			
			await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext
			});
			
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const prompt = spawnCalls[1][1][3];
			
			expect(prompt).toContain('# Active File');
			expect(prompt).toContain('file.ts');
		});
		
		it('should include shared context when provided', async () => {
			const { findInPath, spawnProcess } = await import('./cliSpawner');
			
			vi.mocked(findInPath).mockResolvedValue('/usr/bin/gh');
			vi.mocked(spawnProcess)
				.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
				.mockResolvedValueOnce({
					stdout: 'Response',
					stderr: '',
					exitCode: 0
				});
			
			await executor.executeCopilotCli({
				roleName: 'Developer',
				systemPrompt: 'Test',
				userQuery: 'Test',
				context: mockContext,
				sharedContext: 'Important shared information'
			});
			
			const spawnCalls = vi.mocked(spawnProcess).mock.calls;
			const prompt = spawnCalls[1][1][3];
			
			expect(prompt).toContain('# Shared Context');
			expect(prompt).toContain('Important shared information');
		});
	});
});
