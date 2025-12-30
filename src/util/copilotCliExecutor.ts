/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { spawnProcess, findInPath } from './cliSpawner';
import { IPanelContext } from '../context/panelContextBuilder';
import { PanelTurn } from '../session/panelConversation';

/**
 * Options for executing GitHub Copilot CLI
 */
export interface CopilotCliOptions {
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
	/** Cancellation token */
	token?: vscode.CancellationToken;
	/** Progress callback */
	onProgress?: (message: string) => void;
}

/**
 * Result of CLI execution
 */
export interface CopilotCliResult {
	roleName: string;
	content: string;
	model: string;
	error?: string;
}

/**
 * GitHub Copilot CLI Executor
 * Handles invocation of gh copilot CLI for role-based tasks
 */
export class CopilotCliExecutor {
	private ghCliPath: string | undefined;
	private isCliAvailable: boolean | undefined;
	
	/**
	 * Find the gh CLI executable
	 */
	private async findGhCli(): Promise<string | undefined> {
		if (this.ghCliPath !== undefined) {
			return this.ghCliPath;
		}
		
		// Try to find gh in PATH
		this.ghCliPath = await findInPath('gh');
		this.isCliAvailable = this.ghCliPath !== undefined;
		
		return this.ghCliPath;
	}
	
	/**
	 * Check if gh CLI is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		const ghPath = await this.findGhCli();
		if (!ghPath) {
			return false;
		}
		
		try {
			const result = await spawnProcess(ghPath, ['auth', 'status'], {
				timeout: 5000
			});
			return result.exitCode === 0;
		} catch (error) {
			return false;
		}
	}
	
	/**
	 * Check if CLI is available and ready to use
	 */
	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		const ghPath = await this.findGhCli();
		if (!ghPath) {
			return {
				available: false,
				error: 'GitHub CLI (gh) not found in PATH. Install from: https://cli.github.com'
			};
		}
		
		const authenticated = await this.isAuthenticated();
		if (!authenticated) {
			return {
				available: false,
				error: 'GitHub CLI not authenticated. Run: gh auth login'
			};
		}
		
		return { available: true };
	}
	
	/**
	 * Build the full prompt for a role
	 */
	private buildPrompt(options: CopilotCliOptions): string {
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
	 * Strip ANSI escape codes from text
	 */
	private stripAnsi(text: string): string {
		// eslint-disable-next-line no-control-regex
		return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
	}
	
	/**
	 * Execute GitHub Copilot CLI for a role
	 */
	async executeCopilotCli(options: CopilotCliOptions): Promise<CopilotCliResult> {
		try {
			// Check availability
			const availability = await this.checkAvailability();
			if (!availability.available) {
				return {
					roleName: options.roleName,
					content: '',
					model: 'gh-copilot-cli',
					error: availability.error
				};
			}
			
			// Build the full prompt
			const prompt = this.buildPrompt(options);
			
			// Report progress
			options.onProgress?.(`${options.roleName}: Invoking gh copilot CLI...`);
			
			// Prepare CLI arguments
			const args = [
				'copilot',
				'suggest',
				'-p',
				prompt
			];
			
			// Execute the CLI
			const ghPath = await this.findGhCli();
			if (!ghPath) {
				throw new Error('gh CLI path unexpectedly undefined');
			}
			
			const result = await spawnProcess(ghPath, args, {
				env: {
					NO_COLOR: '1',        // Disable colors
					CLICOLOR: '0',        // Disable ANSI escape codes
					CLICOLOR_FORCE: '0'   // Force no colors
				},
				onStdout: (data) => {
					// Stream progress if needed
					const clean = this.stripAnsi(data);
					if (clean.trim()) {
						options.onProgress?.(`${options.roleName}: ${clean.trim().substring(0, 50)}...`);
					}
				},
				token: options.token,
				timeout: 60000 // 60 seconds for CLI execution
			});
			
			// Check for errors
			if (result.exitCode !== 0) {
				const errorMessage = this.stripAnsi(result.stderr || result.stdout);
				return {
					roleName: options.roleName,
					content: '',
					model: 'gh-copilot-cli',
					error: `CLI exited with code ${result.exitCode}: ${errorMessage}`
				};
			}
			
			// Parse and clean the output
			const output = this.stripAnsi(result.stdout.trim());
			
			if (!output) {
				return {
					roleName: options.roleName,
					content: '',
					model: 'gh-copilot-cli',
					error: 'CLI returned empty output'
				};
			}
			
			return {
				roleName: options.roleName,
				content: output,
				model: 'gh-copilot-cli'
			};
			
		} catch (error) {
			// Handle specific error types
			let errorMessage = 'Unknown error';
			
			if (error instanceof Error) {
				if (error.message.includes('ENOENT')) {
					errorMessage = 'GitHub CLI not found. Install from: https://cli.github.com';
				} else if (error.message.includes('timed out')) {
					errorMessage = 'CLI execution timed out after 60 seconds';
				} else if (error instanceof vscode.CancellationError) {
					errorMessage = 'Execution cancelled';
				} else {
					errorMessage = error.message;
				}
			}
			
			console.error(`[CopilotCliExecutor] Error executing CLI for ${options.roleName}:`, error);
			
			return {
				roleName: options.roleName,
				content: '',
				model: 'gh-copilot-cli',
				error: errorMessage
			};
		}
	}
}
