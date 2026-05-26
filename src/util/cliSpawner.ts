/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import * as vscode from 'vscode';

/**
 * Result of a spawned process execution
 */
export interface SpawnResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Options for spawning a process
 */
export interface SpawnOptions {
	/** Working directory for the process */
	cwd?: string;
	/** Environment variables (merged with process.env) */
	env?: Record<string, string>;
	/** Callback for stdout data chunks */
	onStdout?: (data: string) => void;
	/** Callback for stderr data chunks */
	onStderr?: (data: string) => void;
	/** Cancellation token to abort the process */
	token?: vscode.CancellationToken;
	/** Timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Spawn a child process with streaming support and cancellation
 * 
 * @param command Command to execute
 * @param args Command arguments
 * @param options Spawn options
 * @returns Promise resolving to spawn result
 */
export async function spawnProcess(
	command: string,
	args: string[],
	options: SpawnOptions = {}
): Promise<SpawnResult> {
	return new Promise((resolve, reject) => {
		const stdout: string[] = [];
		const stderr: string[] = [];
		let timeoutId: NodeJS.Timeout | undefined;
		
		// Merge environment variables
		const env = {
			...process.env,
			...options.env
		};
		
		// Spawn the process
		const child = spawn(command, args, {
			cwd: options.cwd,
			env,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		
		// Handle stdout
		child.stdout?.on('data', (data: Buffer) => {
			const str = data.toString();
			stdout.push(str);
			options.onStdout?.(str);
		});
		
		// Handle stderr
		child.stderr?.on('data', (data: Buffer) => {
			const str = data.toString();
			stderr.push(str);
			options.onStderr?.(str);
		});
		
		// Handle process errors (e.g., ENOENT)
		child.on('error', (error) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			reject(error);
		});
		
		// Handle process exit
		child.on('close', (code) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			resolve({
				stdout: stdout.join(''),
				stderr: stderr.join(''),
				exitCode: code ?? -1
			});
		});
		
		// Handle cancellation
		if (options.token) {
			options.token.onCancellationRequested(() => {
				if (timeoutId) {
					clearTimeout(timeoutId);
				}
				child.kill('SIGTERM');
				reject(new vscode.CancellationError());
			});
		}
		
		// Handle timeout
		const timeout = options.timeout ?? 30000; // 30 seconds default
		if (timeout > 0) {
			timeoutId = setTimeout(() => {
				child.kill('SIGTERM');
				reject(new Error(`Process timed out after ${timeout}ms`));
			}, timeout);
		}
	});
}

/**
 * Find an executable in the system PATH
 * 
 * @param executable Name of the executable to find
 * @returns Path to the executable, or undefined if not found
 */
export async function findInPath(executable: string): Promise<string | undefined> {
	const isWindows = process.platform === 'win32';
	const command = isWindows ? 'where' : 'which';
	
	try {
		const result = await spawnProcess(command, [executable], { timeout: 5000 });
		if (result.exitCode === 0 && result.stdout.trim()) {
			// Return first line (in case multiple paths are found)
			return result.stdout.trim().split('\n')[0];
		}
	} catch (error) {
		// Command not found or other error
		return undefined;
	}
	
	return undefined;
}
