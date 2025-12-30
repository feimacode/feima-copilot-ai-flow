/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IPanelContext } from '../context/panelContextBuilder';
import { PanelTurn } from '../session/panelConversation';

// Dynamic import for ESM-only @github/copilot package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkModule: any;

async function getSdk() {
	if (!sdkModule) {
		// Use eval to bypass TypeScript/bundler and force runtime import
		const dynamicImport = new Function('specifier', 'return import(specifier)');
		sdkModule = await dynamicImport('@github/copilot/sdk');
	}
	return sdkModule;
}

// Type aliases for SDK types (using unknown for proper type safety)
type SweCustomAgent = unknown; // Will be properly typed from SDK at runtime
type SessionEvent = unknown;   // Will be properly typed from SDK at runtime

/**
 * Options for executing GitHub Copilot SDK
 */
export interface CopilotSdkOptions {
	/** Role name */
	roleName: string;
	/** Role system prompt */
	systemPrompt: string;
	/** User query/task */
	userQuery: string;
	/** VS Code context (workspace, files, etc.) */
	context: IPanelContext;
	/** Shared context across roles */
	sharedContext?: string;
	/** Conversation history */
	history?: PanelTurn[];
	/** Custom agent to use */
	customAgent?: SweCustomAgent;
	/** Model to use */
	model?: string;
	/** Cancellation token */
	token?: vscode.CancellationToken;
	/** Progress callback */
	onProgress?: (message: string) => void;
}

/**
 * Result of SDK execution
 */
export interface CopilotSdkResult {
	roleName: string;
	content: string;
	model: string;
	error?: string;
}

/**
 * GitHub Copilot SDK Executor
 * Handles invocation of GitHub Copilot SDK for role-based tasks
 */
export class CopilotSdkExecutor {
	private availableAgents: SweCustomAgent[] | undefined;

	/**
	 * Get available custom agents
	 */
	async getAvailableAgents(workingDirectory?: string): Promise<SweCustomAgent[]> {
		if (this.availableAgents !== undefined) {
			return this.availableAgents;
		}

		try {
			const sdk = await getSdk();
			const workingDir = workingDirectory || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
			
			// Get auth info from environment or gh CLI
			const authInfo = await this.getAuthInfo();
			if (!authInfo) {
				return [];
			}

			this.availableAgents = await sdk.getCustomAgents(authInfo, workingDir);
			return this.availableAgents as unknown[];
		} catch (error) {
			console.error('[CopilotSdkExecutor] Failed to get custom agents:', error);
			return [];
		}
	}

	/**
	 * Get authentication info
	 */
	private async getAuthInfo(): Promise<{ type: string; host: string; token?: string; login?: string } | undefined> {
		try {
			// First try: Use gh-cli authentication (best for GitHub Copilot users)
			// This delegates to the `gh` CLI which is already authenticated if user has Copilot
			try {
				const { execFile } = await import('child_process');
				const { promisify } = await import('util');
				const execFileAsync = promisify(execFile);
				
				// Check if gh CLI is available and authenticated
				await execFileAsync('gh', ['auth', 'status'], { 
					timeout: 5000 
				});
				
				// Get token from gh CLI
				const { stdout: tokenOutput } = await execFileAsync('gh', ['auth', 'token'], { 
					timeout: 5000 
				});
				const token = tokenOutput.trim();
				
				// Get login from gh CLI
				const { stdout: loginOutput } = await execFileAsync('gh', ['api', 'user', '--jq', '.login'], { 
					timeout: 5000 
				});
				const login = loginOutput.trim();
				
				if (token && login) {
					console.log('[CopilotSdkExecutor] Using gh-cli authentication');
					return {
						type: 'gh-cli',
						host: 'https://github.com',
						login,
						token
					};
				}
			} catch (ghError) {
				console.log('[CopilotSdkExecutor] gh CLI not available or not authenticated, trying VS Code auth...');
			}

			// Second try: Get GitHub token from VS Code authentication
			const session = await vscode.authentication.getSession('github', ['user:email', 'read:user'], { 
				createIfNone: false,
				silent: true 
			});

			if (session) {
				console.log('[CopilotSdkExecutor] Using VS Code GitHub authentication');
				return {
					type: 'token',
					host: 'https://github.com',
					token: session.accessToken
				};
			}

			// Third try: Environment variable
			const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
			if (envToken) {
				console.log('[CopilotSdkExecutor] Using environment variable authentication');
				return {
					type: 'token',
					host: 'https://github.com',
					token: envToken
				};
			}

			return undefined;
		} catch (error) {
			console.error('[CopilotSdkExecutor] Failed to get auth info:', error);
			return undefined;
		}
	}

	/**
	 * Check if SDK is available and authenticated
	 */
	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		const authInfo = await this.getAuthInfo();
		if (!authInfo) {
			return {
				available: false,
				error: 'GitHub authentication required. Please sign in to GitHub in VS Code or set GITHUB_TOKEN environment variable.'
			};
		}

		return { available: true };
	}

	/**
	 * Build the full prompt for a role
	 */
	private buildPrompt(options: CopilotSdkOptions): string {
		const parts: string[] = [];

		// System prompt (role definition)
		parts.push('# Role');
		parts.push(options.systemPrompt);
		parts.push('');

		// Shared context
		if (options.sharedContext) {
			parts.push('# Shared Context');
			parts.push(options.sharedContext);
			parts.push('');
		}

		// VS Code context
		if (options.context.workspace?.folders && options.context.workspace.folders.length > 0) {
			parts.push('# Workspace');
			parts.push(`Folders: ${options.context.workspace.folders.join(', ')}`);
			parts.push('');
		}

		if (options.context.activeEditor) {
			parts.push('# Active File');
			parts.push(`Path: ${options.context.activeEditor.fileName}`);
			const editor = vscode.window.activeTextEditor;
			if (editor && !editor.selection.isEmpty) {
				const selectedText = editor.document.getText(editor.selection);
				parts.push('');
				parts.push('Selected text:');
				parts.push('```');
				parts.push(selectedText);
				parts.push('```');
			}
			parts.push('');
		}

		// Conversation history
		if (options.history && options.history.length > 0) {
			parts.push('# Previous Discussion');
			for (const turn of options.history) {
				parts.push(`User: ${turn.query}`);
				for (const [roleName, response] of turn.responses.entries()) {
					parts.push(`${roleName}: ${response}`);
				}
				parts.push('');
			}
		}

		// User query/task
		parts.push('# Task');
		parts.push(options.userQuery);

		return parts.join('\n');
	}

	/**
	 * Execute GitHub Copilot SDK for a role
	 */
	async executeCopilotSdk(options: CopilotSdkOptions): Promise<CopilotSdkResult> {
		try {
			// Check availability
			const availability = await this.checkAvailability();
			if (!availability.available) {
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'claude-sonnet-4.5',
					error: availability.error
				};
			}

			// Build the full prompt
			const prompt = this.buildPrompt(options);

			// Report progress
			options.onProgress?.(`${options.roleName}: Starting...`);

			// Get authentication
			const authInfo = await this.getAuthInfo();
			if (!authInfo) {
				throw new Error('Authentication required');
			}

			// Get working directory (folders are already file paths)
			const workingDirectory = options.context.workspace?.folders?.[0] || process.cwd();

			// Prepare session options for query
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const queryOptions: any = {
				prompt,
				workingDirectory,
				model: (options.model as 'claude-sonnet-4.5' | 'claude-haiku-4.5' | 'claude-opus-4.5' | 'gpt-5' | 'gpt-5.1' | undefined) || 'claude-sonnet-4.5',
				authInfo,
				selectedCustomAgent: options.customAgent,
				enableStreaming: true,
				// Session recording options (for debugging/analysis)
				// trajectoryFile: '/tmp/copilot-trajectory.json',  // Uncomment to record session trajectory
				// eventsLogDirectory: '/tmp/copilot-events',       // Uncomment to log all events
				// logger: new ConsoleLogger()                      // Uncomment for SDK debug logging
			};

			// Debug logging
			console.log('[CopilotSdkExecutor] Query options:', {
				workingDirectory,
				model: queryOptions.model,
				authType: authInfo?.type,
				hasPrompt: !!prompt,
				customAgent: options.customAgent
			});

			// Execute the query
			const sdk = await getSdk();
			console.log('[CopilotSdkExecutor] ✅ Executing query via GitHub Copilot SDK (not API mode)');
			const events = sdk.query(queryOptions);

			let content = '';
			const modelUsed = options.model || 'claude-sonnet-4.5';

			// Process events
			try {
				for await (const event of events) {
					// Check for cancellation
					if (options.token?.isCancellationRequested) {
						throw new vscode.CancellationError();
					}

					await this.handleEvent(event, options, (text) => {
						content += text;
					});
				}
			} catch (error) {
				if (error instanceof vscode.CancellationError) {
					throw error;
				}
				throw error;
			}

			if (!content.trim()) {
				return {
					roleName: options.roleName,
					content: '',
					model: modelUsed,
					error: 'SDK returned empty output'
				};
			}

			console.log(`[CopilotSdkExecutor] ✅ SDK query completed successfully for ${options.roleName}`);

			return {
				roleName: options.roleName,
				content: content.trim(),
				model: modelUsed
			};

		} catch (error) {
			// Handle specific error types
			let errorMessage = 'Unknown error';

			if (error instanceof vscode.CancellationError) {
				errorMessage = 'Execution cancelled';
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}

			console.error(`[CopilotSdkExecutor] Error executing SDK for ${options.roleName}:`, error);

			return {
				roleName: options.roleName,
				content: '',
				model: options.model || 'claude-sonnet-4.5',
				error: errorMessage
			};
		}
	}

	/**
	 * Handle individual session events
	 */
	private async handleEvent(
		event: SessionEvent,
		options: CopilotSdkOptions,
		onContent: (text: string) => void
	): Promise<void> {
		// Type guard for event structure
		const evt = event as { type: string; data?: { content?: string; message?: string; name?: string } };
		
		switch (evt.type) {
			case 'assistant.message':
				// Streaming message content
				if (evt.data?.content) {
					onContent(evt.data.content);
					// Show progress with first few characters
					const preview = evt.data.content.trim().substring(0, 50);
					if (preview) {
						options.onProgress?.(`${options.roleName}: ${preview}...`);
					}
				}
				break;

			case 'assistant.turn.start':
				options.onProgress?.(`${options.roleName}: Thinking...`);
				break;

			case 'assistant.turn.end':
				options.onProgress?.(`${options.roleName}: Complete`);
				break;

			case 'session.error':
				// Log the full error for debugging
				console.error('[CopilotSdkExecutor] Session error event:', JSON.stringify(evt, null, 2));
				throw new Error(`Execution failed: ${evt.data?.message || 'Session error occurred'}`);

			case 'tool_call.requested':
				options.onProgress?.(`${options.roleName}: Using tool ${evt.data?.name}...`);
				break;

			case 'tool_call.completed':
				// Tool completed, continue processing
				break;

			default:
				// Ignore other event types
				break;
		}
	}
}
