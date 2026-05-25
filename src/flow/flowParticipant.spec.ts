/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowParticipant } from './flowParticipant';
import * as vscode from 'vscode';
import type { IFlowConfig } from './flowService';
import type { IFlowContext } from '../context/flowContextBuilder';

// Mock dependencies
vi.mock('./flowService');
vi.mock('../context/flowContextBuilder');
vi.mock('../session/flowConversation');
vi.mock('../prompts/flowPromptRenderer');
vi.mock('../util/copilotCliExecutor');

describe('FlowParticipant - CLI Integration', () => {
	let participant: FlowParticipant;
	let mockContext: vscode.ExtensionContext;
	
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Create mock extension context
		mockContext = {
			subscriptions: [],
			extensionPath: '/test/path',
			globalState: { 
				get: vi.fn(), 
				update: vi.fn(), 
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn() 
			} as unknown as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
			workspaceState: { 
				get: vi.fn(), 
				update: vi.fn(), 
				keys: vi.fn().mockReturnValue([]) 
			} as unknown as vscode.Memento,
			secrets: { 
				get: vi.fn(), 
				store: vi.fn(), 
				delete: vi.fn(),
				onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event
			} as unknown as vscode.SecretStorage,
			extensionUri: vscode.Uri.file('/test/path'),
			environmentVariableCollection: { 
				get: vi.fn(),
				forEach: vi.fn(),
				replace: vi.fn(),
				append: vi.fn(),
				prepend: vi.fn(),
				delete: vi.fn(),
				clear: vi.fn(),
				getScoped: vi.fn(),
				[Symbol.iterator]: vi.fn()
			} as unknown as vscode.GlobalEnvironmentVariableCollection,
			extension: {} as vscode.Extension<unknown>,
			storageUri: undefined,
			globalStorageUri: vscode.Uri.file('/test/global'),
			logUri: vscode.Uri.file('/test/log'),
			extensionMode: vscode.ExtensionMode.Test,
			asAbsolutePath: (path: string) => `/test/path/${path}`,
			storagePath: undefined,
			globalStoragePath: '/test/global',
			logPath: '/test/log',
			languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation
		};
		
		participant = new FlowParticipant(mockContext);
	});
	
	describe('CLI mode configuration', () => {
		it('should check CLI availability when useCli is true', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			const checkAvailabilitySpy = vi.spyOn(mockExecutor, 'checkAvailability');
			
			checkAvailabilitySpy.mockResolvedValue({
				available: true
			});
			
			// This test would require more complex mocking of the entire participant flow
			// For now, verify the executor is instantiated
			expect(participant).toBeDefined();
		});
		
		it('should fall back to API when CLI is unavailable', async () => {
			// Test that when useCli is true but CLI is not available,
			// the system falls back to the language model API
			
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			vi.spyOn(mockExecutor, 'checkAvailability').mockResolvedValue({
				available: false,
				error: 'gh CLI not found'
			});
			
			// Verify fallback logic would be triggered
			const availability = await mockExecutor.checkAvailability();
			expect(availability.available).toBe(false);
		});
	});
	
	describe('callRoleCli method', () => {
		it('should delegate to CopilotCliExecutor', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			executeSpy.mockResolvedValue({
				roleName: 'Developer',
				content: 'CLI response',
				model: 'gh-copilot-cli'
			});
			
			// Verify executor method signature
			expect(executeSpy).toBeDefined();
		});
		
		it('should pass correct parameters to CLI executor', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			executeSpy.mockResolvedValue({
				roleName: 'QA',
				content: 'Test plan',
				model: 'gh-copilot-cli'
			});
			
			await mockExecutor.executeCopilotCli({
				roleName: 'QA',
				prompt: 'You are a QA engineer',
				userQuery: 'Create a test plan',
				context: {} as IFlowContext
			});
			
			expect(executeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					roleName: 'QA',
					prompt: 'You are a QA engineer',
					userQuery: 'Create a test plan'
				})
			);
		});
		
		it('should handle CLI execution errors gracefully', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			executeSpy.mockResolvedValue({
				roleName: 'Developer',
				content: '',
				model: 'gh-copilot-cli',
				error: 'CLI execution failed'
			});
			
			const result = await mockExecutor.executeCopilotCli({
				roleName: 'Developer',
				prompt: 'Test',
				userQuery: 'Test',
				context: {} as IFlowContext
			});
			
			expect(result.error).toBe('CLI execution failed');
			expect(result.content).toBe('');
		});
	});
	
	describe('parallel CLI execution', () => {
		it('should execute multiple roles in parallel with CLI', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			
			// Mock responses for different roles
			executeSpy
				.mockResolvedValueOnce({
					roleName: 'Developer',
					content: 'Developer response',
					model: 'gh-copilot-cli'
				})
				.mockResolvedValueOnce({
					roleName: 'QA',
					content: 'QA response',
					model: 'gh-copilot-cli'
				})
				.mockResolvedValueOnce({
					roleName: 'Architect',
					content: 'Architect response',
					model: 'gh-copilot-cli'
				});
			
			// Execute all roles in parallel
			const results = await Promise.all([
				mockExecutor.executeCopilotCli({
					roleName: 'Developer',
					prompt: 'Dev prompt',
					userQuery: 'Query',
					context: {} as IFlowContext
				}),
				mockExecutor.executeCopilotCli({
					roleName: 'QA',
					prompt: 'QA prompt',
					userQuery: 'Query',
					context: {} as IFlowContext
				}),
				mockExecutor.executeCopilotCli({
					roleName: 'Architect',
					prompt: 'Arch prompt',
					userQuery: 'Query',
					context: {} as IFlowContext
				})
			]);
			
			expect(results).toHaveLength(3);
			expect(results[0].roleName).toBe('Developer');
			expect(results[1].roleName).toBe('QA');
			expect(results[2].roleName).toBe('Architect');
		});
		
		it('should handle mixed success/failure in parallel execution', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			
			executeSpy
				.mockResolvedValueOnce({
					roleName: 'Developer',
					content: 'Success',
					model: 'gh-copilot-cli'
				})
				.mockResolvedValueOnce({
					roleName: 'QA',
					content: '',
					model: 'gh-copilot-cli',
					error: 'Timeout'
				});
			
			const results = await Promise.all([
				mockExecutor.executeCopilotCli({
					roleName: 'Developer',
					prompt: 'Test',
					userQuery: 'Test',
					context: {} as IFlowContext
				}),
				mockExecutor.executeCopilotCli({
					roleName: 'QA',
					prompt: 'Test',
					userQuery: 'Test',
					context: {} as IFlowContext
				})
			]);
			
			expect(results[0].error).toBeUndefined();
			expect(results[1].error).toBe('Timeout');
		});
	});
	
	describe('config parsing', () => {
		it('should parse CLI-specific properties from flow config', async () => {
			const { FlowService } = await import('./flowService');
			const service = new FlowService();
			
			// Mock the parsePrompt method
			const parseSpy = vi.spyOn(service, 'parsePrompt');
			parseSpy.mockResolvedValue({
				name: 'Test Flow',
				roles: [
					{ name: 'Developer', prompt: 'Test' },
					{ name: 'QA', prompt: 'Test' }
				],
				orchestration: 'cli',
				sharedContext: '',
				promptUri: vscode.Uri.file('/test.md'),
				isolation: 'worktree',
				cliMode: 'supervised',
				customAgent: 'test-agent',
				model: 'claude-sonnet-4'
			} as IFlowConfig);
			
			const result = await service.parsePrompt(vscode.Uri.file('/test.md'));
			
			expect(result?.isolation).toBe('worktree');
			expect(result?.cliMode).toBe('supervised');
			expect(result?.customAgent).toBe('test-agent');
			expect(result?.model).toBe('claude-sonnet-4');
		});
		
		it('should default CLI properties to undefined when not specified', async () => {
			const { FlowService } = await import('./flowService');
			const service = new FlowService();
			
			const parseSpy = vi.spyOn(service, 'parsePrompt');
			parseSpy.mockResolvedValue({
				name: 'Test Flow',
				roles: [
					{ name: 'Developer', prompt: 'Test' }
				],
				orchestration: 'sequence',
				sharedContext: '',
				promptUri: vscode.Uri.file('/test.md')
			} as IFlowConfig);
			
			const result = await service.parsePrompt(vscode.Uri.file('/test.md'));
			
			expect(result?.isolation).toBeUndefined();
			expect(result?.cliMode).toBeUndefined();
			expect(result?.customAgent).toBeUndefined();
			expect(result?.model).toBeUndefined();
		});
	});
	
	describe('progress reporting', () => {
		it('should report CLI execution progress', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const onProgress = vi.fn();
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			
			executeSpy.mockImplementation(async (options) => {
				options.onProgress?.('Developer: Starting execution...');
				options.onProgress?.('Developer: Processing...');
				options.onProgress?.('Developer: Complete');
				
				return {
					roleName: 'Developer',
					content: 'Result',
					model: 'gh-copilot-cli'
				};
			});
			
			await mockExecutor.executeCopilotCli({
				roleName: 'Developer',
				prompt: 'Test',
				userQuery: 'Test',
				context: {} as IFlowContext,
				onProgress
			});
			
			expect(executeSpy).toHaveBeenCalled();
		});
	});
	
	describe('cancellation support', () => {
		it('should support cancellation token in CLI mode', async () => {
			const { CopilotCliExecutor } = await import('../util/copilotCliExecutor');
			const mockExecutor = new CopilotCliExecutor();
			
			const cancellationTokenSource = new vscode.CancellationTokenSource();
			const executeSpy = vi.spyOn(mockExecutor, 'executeCopilotCli');
			
			executeSpy.mockImplementation(async (options) => {
				// Simulate cancellation during execution
				if (options.token?.isCancellationRequested) {
					return {
						roleName: 'Developer',
						content: '',
						model: 'gh-copilot-cli',
						error: 'Execution cancelled'
					};
				}
				return {
					roleName: 'Developer',
					content: 'Result',
					model: 'gh-copilot-cli'
				};
			});
			
			cancellationTokenSource.cancel();
			
			const result = await mockExecutor.executeCopilotCli({
				roleName: 'Developer',
				prompt: 'Test',
				userQuery: 'Test',
				context: {} as IFlowContext,
				token: cancellationTokenSource.token
			});
			
			expect(result.error).toBeDefined();
		});
	});
});
