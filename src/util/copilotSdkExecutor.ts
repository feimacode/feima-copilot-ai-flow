/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFlowContext } from '../context/flowContextBuilder';
import { FlowTurn } from '../session/flowConversation';
import { ILogger } from '../platform/log/common/logService';

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
type Session = unknown;        // Will be properly typed from SDK at runtime
type LocalSessionManager = unknown; // Will be properly typed from SDK at runtime

/**
 * Execution mode for GitHub Copilot
 */
export type ExecutionMode = 'sdk-session' | 'cli-spawn' | 'sdk-query';

/**
 * Options for executing GitHub Copilot SDK
 */
export interface CopilotSdkOptions {
	/** Role name */
	roleName: string;
	/** Role system prompt */
	prompt: string;
	/** User query/task */
	userQuery: string;
	/** VS Code context (workspace, files, etc.) */
	context: IFlowContext;
	/** Shared context across roles */
	sharedContext?: string;
	/** Conversation history */
	history?: FlowTurn[];
	/** Custom agent to use */
	customAgent?: SweCustomAgent;
	/** Model to use */
	model?: string;
	/** Cancellation token */
	token?: vscode.CancellationToken;
	/** Progress callback */
	onProgress?: (message: string) => void;
	/** Execution mode (defaults to 'sdk-query' for lightweight execution) */
	mode?: ExecutionMode;
	/** Session ID for resuming existing session (sdk-session mode only) */
	sessionId?: string;
}

/**
 * Result of SDK execution
 */
export interface CopilotSdkResult {
	roleName: string;
	content: string;
	model: string;
	error?: string;
	/** Session ID for persistent sessions (sdk-session mode) */
	sessionId?: string;
	/** Execution mode used */
	mode?: ExecutionMode;
}

/**
 * GitHub Copilot SDK Executor
 * Handles invocation of GitHub Copilot SDK for role-based tasks
 * Supports three execution modes:
 * - 'sdk-query': Lightweight stateless query (current default)
 * - 'sdk-session': Persistent session with history saved to ~/.copilot/session-state/
 * - 'cli-spawn': Spawn gh copilot CLI as subprocess
 */
export class CopilotSdkExecutor {
	private readonly log: ILogger;
	private availableAgents: SweCustomAgent[] | undefined;
	private sessionManager: LocalSessionManager | undefined;

	constructor(log: ILogger) {
		this.log = log;
	}

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
			this.log.error(error instanceof Error ? error : String(error), 'Failed to get custom agents');
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
					this.log.debug('Using gh-cli authentication');
					return {
						type: 'gh-cli',
						host: 'https://github.com',
						login,
						token
					};
				}
			} catch (ghError) {
				this.log.debug('gh CLI not available or not authenticated, trying VS Code auth...');
			}

			// Second try: Get GitHub token from VS Code authentication
			const session = await vscode.authentication.getSession('github', ['user:email', 'read:user'], { 
				createIfNone: false,
				silent: true 
			});

			if (session) {
				this.log.debug('Using VS Code GitHub authentication');
				return {
					type: 'token',
					host: 'https://github.com',
					token: session.accessToken
				};
			}

			// Third try: Environment variable
			const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
			if (envToken) {
				this.log.debug('Using environment variable authentication');
				return {
					type: 'token',
					host: 'https://github.com',
					token: envToken
				};
			}

			return undefined;
		} catch (error) {
			this.log.error(error instanceof Error ? error : String(error), 'Failed to get auth info');
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
		parts.push(options.prompt);
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
	 * Routes to appropriate execution mode based on options.mode
	 */
	async executeCopilotSdk(options: CopilotSdkOptions): Promise<CopilotSdkResult> {
		const mode = options.mode || 'sdk-query';
		
		// Route to appropriate execution mode
		switch (mode) {
			case 'sdk-session':
				return this.executeViaSdkSession(options);
			case 'cli-spawn':
				return this.executeViaCliSpawn(options);
			case 'sdk-query':
				return this.executeViaSdkQuery(options);
			default:
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'claude-sonnet-4.5',
					error: `Unknown execution mode: ${mode}`
				};
		}
	}
	
	/**
	 * Execute via SDK query (lightweight, stateless)
	 * Original implementation - good for quick parallel role execution
	 */
	private async executeViaSdkQuery(options: CopilotSdkOptions): Promise<CopilotSdkResult> {
		try {
			// Check availability
			const availability = await this.checkAvailability();
			if (!availability.available) {
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'claude-sonnet-4.5',
					error: availability.error,
					mode: 'sdk-query'
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
			this.log.debug(`Query options: workingDirectory=${workingDirectory}, model=${queryOptions.model}, authType=${authInfo?.type}, customAgent=${options.customAgent}`);

			// Execute the query
			const sdk = await getSdk();
			this.log.debug('Executing query via GitHub Copilot SDK');
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
					error: 'SDK returned empty output',
					mode: 'sdk-query'
				};
			}

			this.log.debug(`SDK query completed for ${options.roleName}`);

			return {
				roleName: options.roleName,
				content: content.trim(),
				model: modelUsed,
				mode: 'sdk-query'
			};

		} catch (error) {
			// Handle specific error types
			let errorMessage = 'Unknown error';

			if (error instanceof vscode.CancellationError) {
				errorMessage = 'Execution cancelled';
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}

			this.log.error(error instanceof Error ? error : String(error), `Error executing SDK query for ${options.roleName}`);

			return {
				roleName: options.roleName,
				content: '',
				model: options.model || 'claude-sonnet-4.5',
				error: errorMessage,
				mode: 'sdk-query'
			};
		}
	}
	
	/**
	 * Execute via SDK session (persistent, with history saved to disk)
	 * Creates/resumes session in ~/.copilot/session-state/*.jsonl
	 */
	private async executeViaSdkSession(options: CopilotSdkOptions): Promise<CopilotSdkResult> {
		try {
			// Check availability
			const availability = await this.checkAvailability();
			if (!availability.available) {
				// Fallback to CLI spawn if SDK not available
				this.log.warn('SDK not available, falling back to CLI spawn');
				return this.executeViaCliSpawn(options);
			}
			
			// Get SDK and session manager
			const sdk = await getSdk();
			if (!this.sessionManager) {
				this.sessionManager = new sdk.LocalSessionManager() as LocalSessionManager;
			}
			
			// Get authentication
			const authInfo = await this.getAuthInfo();
			if (!authInfo) {
				throw new Error('Authentication required');
			}
			
			// Get working directory
			const workingDirectory = options.context.workspace?.folders?.[0] || process.cwd();
			
			// Build prompt
			const prompt = this.buildPrompt(options);
			
			options.onProgress?.(`${options.roleName}: Creating session...`);
			
			// Create or resume session
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sessionOptions: any = {
				model: options.model || 'claude-sonnet-4.5',
				workingDirectory,
				authInfo,
				selectedCustomAgent: options.customAgent,
				enableStreaming: true
			};
			
			let session: Session;
			let sessionId: string;
			
			if (options.sessionId) {
				// Resume existing session
				session = await (this.sessionManager as any).getSession(options.sessionId, sessionOptions);
				sessionId = options.sessionId;
				options.onProgress?.(`${options.roleName}: Resuming session ${sessionId}...`);
			} else {
				// Create new session
				session = await (this.sessionManager as any).createSession(sessionOptions);
				sessionId = (session as any).sessionId;
				options.onProgress?.(`${options.roleName}: Session ${sessionId} created`);
			}
			
			this.log.debug(`Using SDK session ${sessionId}`);
			
			// Send prompt to session
			options.onProgress?.(`${options.roleName}: Sending prompt...`);
			const responseStream = await (session as any).send(prompt);
			
			let content = '';
			const modelUsed = options.model || 'claude-sonnet-4.5';
			
			// Process response stream
			for await (const event of responseStream) {
				if (options.token?.isCancellationRequested) {
					throw new vscode.CancellationError();
				}
				
				await this.handleEvent(event, options, (text) => {
					content += text;
				});
			}
			
			if (!content.trim()) {
				return {
					roleName: options.roleName,
					content: '',
					model: modelUsed,
					error: 'Session returned empty output',
					sessionId,
					mode: 'sdk-session'
				};
			}
			
			this.log.debug(`SDK session ${sessionId} completed for ${options.roleName}`);
			
			return {
				roleName: options.roleName,
				content: content.trim(),
				model: modelUsed,
				sessionId,
				mode: 'sdk-session'
			};
			
		} catch (error) {
			let errorMessage = 'Unknown error';
			
			if (error instanceof vscode.CancellationError) {
				errorMessage = 'Execution cancelled';
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}
			
			this.log.error(error instanceof Error ? error : String(error), `Error executing SDK session for ${options.roleName}`);
			
			// Try fallback to CLI spawn
			if (!options.sessionId) { // Don't fallback if resuming specific session
				this.log.warn('Falling back to CLI spawn');
				return this.executeViaCliSpawn(options);
			}
			
			return {
				roleName: options.roleName,
				content: '',
				model: options.model || 'claude-sonnet-4.5',
				error: errorMessage,
				mode: 'sdk-session'
			};
		}
	}
	
	/**
	 * Execute via CLI spawn (subprocess)
	 * Spawns `gh copilot` as a child process
	 */
	private async executeViaCliSpawn(options: CopilotSdkOptions): Promise<CopilotSdkResult> {
		try {
			options.onProgress?.(`${options.roleName}: Starting CLI process...`);
			
			// Build the full prompt
			const prompt = this.buildPrompt(options);
			
			// Spawn gh copilot CLI
			const { spawn } = await import('child_process');
			
			// Build CLI arguments
			const args = ['copilot'];
			
			if (options.model) {
				args.push('--model', options.model);
			}
			
			if (options.customAgent && typeof options.customAgent === 'string') {
				args.push('--agent', options.customAgent);
			}
			
			// Add non-interactive flag for programmatic usage
			args.push('--non-interactive');
			
			this.log.debug(`Spawning CLI: gh ${args.join(' ')}`);
			
			const child = spawn('gh', args, {
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: options.context.workspace?.folders?.[0] || process.cwd()
			});
			
			let stdout = '';
			let stderr = '';
			
			child.stdout?.on('data', (data) => {
				const chunk = data.toString();
				stdout += chunk;
				// Show progress with streaming output
				const preview = chunk.trim().substring(0, 50);
				if (preview) {
					options.onProgress?.(`${options.roleName}: ${preview}...`);
				}
			});
			
			child.stderr?.on('data', (data) => {
				stderr += data.toString();
			});
			
			// Write prompt to stdin
			child.stdin?.write(prompt);
			child.stdin?.end();
			
			// Wait for process to complete
			const exitCode = await new Promise<number>((resolve) => {
				child.on('close', (code) => resolve(code || 0));
				
				// Handle cancellation
				if (options.token) {
					options.token.onCancellationRequested(() => {
						child.kill('SIGTERM');
						resolve(-1);
					});
				}
			});
			
			if (exitCode === -1) {
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'gh-copilot-cli',
					error: 'Execution cancelled',
					mode: 'cli-spawn'
				};
			}
			
			if (exitCode !== 0) {
				const errorMsg = stderr || stdout || `CLI exited with code ${exitCode}`;
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'gh-copilot-cli',
					error: `CLI error: ${errorMsg}`,
					mode: 'cli-spawn'
				};
			}
			
			if (!stdout.trim()) {
				return {
					roleName: options.roleName,
					content: '',
					model: options.model || 'gh-copilot-cli',
					error: 'CLI returned empty output',
					mode: 'cli-spawn'
				};
			}
			
			this.log.debug(`CLI spawn completed for ${options.roleName}`);
			
			return {
				roleName: options.roleName,
				content: stdout.trim(),
				model: options.model || 'gh-copilot-cli',
				mode: 'cli-spawn'
			};
			
		} catch (error) {
			let errorMessage = 'Unknown error';
			
			if (error instanceof Error) {
				errorMessage = error.message;
			}
			
			this.log.error(error instanceof Error ? error : String(error), `Error executing CLI for ${options.roleName}`);
			
			return {
				roleName: options.roleName,
				content: '',
				model: options.model || 'gh-copilot-cli',
				error: errorMessage,
				mode: 'cli-spawn'
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
					this.log.error(`Session error event: ${JSON.stringify(evt, null, 2)}`);
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
