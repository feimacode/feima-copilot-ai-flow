/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnProcess, findInPath } from './cliSpawner';
import * as vscode from 'vscode';
import { spawn } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
	spawn: vi.fn()
}));

interface MockChild {
	stdout: { on: ReturnType<typeof vi.fn> };
	stderr: { on: ReturnType<typeof vi.fn> };
	on: ReturnType<typeof vi.fn>;
	kill: ReturnType<typeof vi.fn>;
}

describe('cliSpawner', () => {
	describe('spawnProcess', () => {
		let mockChild: MockChild;
		
		beforeEach(() => {
			
			// Create mock child process
			mockChild = {
				stdout: {
					on: vi.fn()
				},
				stderr: {
					on: vi.fn()
				},
				on: vi.fn(),
				kill: vi.fn()
			};
			
			vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
		});
		
		afterEach(() => {
			vi.clearAllMocks();
		});
		
		it('should spawn a process with correct arguments', async () => {
			
			// Simulate successful process
			setTimeout(() => {
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			await spawnProcess('echo', ['hello', 'world']);
			
			expect(spawn).toHaveBeenCalledWith('echo', ['hello', 'world'], expect.objectContaining({
				stdio: ['ignore', 'pipe', 'pipe']
			}));
		});
		
		it('should merge environment variables', async () => {
			setTimeout(() => {
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			await spawnProcess('test', [], {
				env: { CUSTOM_VAR: 'value' }
			});
			
			expect(spawn).toHaveBeenCalledWith('test', [], expect.objectContaining({
				env: expect.objectContaining({
					CUSTOM_VAR: 'value'
				})
			}));
		});
		
		it('should collect stdout data', async () => {
			setTimeout(() => {
				const stdoutHandler = mockChild.stdout.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stdoutHandler?.(Buffer.from('output line 1\n'));
				stdoutHandler?.(Buffer.from('output line 2\n'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			const result = await spawnProcess('test', []);
			
			expect(result.stdout).toBe('output line 1\noutput line 2\n');
			expect(result.exitCode).toBe(0);
		});
		
		it('should collect stderr data', async () => {
			setTimeout(() => {
				const stderrHandler = mockChild.stderr.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stderrHandler?.(Buffer.from('error message\n'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(1);
			}, 10);
			
			const result = await spawnProcess('test', []);
			
			expect(result.stderr).toBe('error message\n');
			expect(result.exitCode).toBe(1);
		});
		
		it('should call onStdout callback', async () => {
			const onStdout = vi.fn();
			
			setTimeout(() => {
				const stdoutHandler = mockChild.stdout.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stdoutHandler?.(Buffer.from('test output'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			await spawnProcess('test', [], { onStdout });
			
			expect(onStdout).toHaveBeenCalledWith('test output');
		});
		
		it('should call onStderr callback', async () => {
			const onStderr = vi.fn();
			
			setTimeout(() => {
				const stderrHandler = mockChild.stderr.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stderrHandler?.(Buffer.from('error output'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			await spawnProcess('test', [], { onStderr });
			
			expect(onStderr).toHaveBeenCalledWith('error output');
		});
		
		it('should handle process errors', async () => {
			setTimeout(() => {
				const errorHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'error')?.[1];
				errorHandler?.(new Error('ENOENT'));
			}, 10);
			
			await expect(spawnProcess('nonexistent', [])).rejects.toThrow('ENOENT');
		});
		
		it('should handle cancellation token', async () => {
			const cancellationTokenSource = new vscode.CancellationTokenSource();
			
			setTimeout(() => {
				cancellationTokenSource.cancel();
			}, 10);
			
			await expect(
				spawnProcess('test', [], { token: cancellationTokenSource.token })
			).rejects.toThrow();
			
			expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
		});
		
		it('should handle timeout', async () => {
			// Process never completes
			const promise = spawnProcess('test', [], { timeout: 100 });
			
			await expect(promise).rejects.toThrow('timed out after 100ms');
			expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
		}, 150);
		
		it('should not timeout when set to 0', async () => {
			setTimeout(() => {
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 150);
			
			await expect(
				spawnProcess('test', [], { timeout: 0 })
			).resolves.toBeDefined();
		}, 200);
	});
	
	describe('findInPath', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});
		
		it('should find executable in PATH on Unix', async () => {
			if (process.platform === 'win32') {
				return; // Skip on Windows
			}
			
			const mockChild: MockChild = {
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn(),
				kill: vi.fn()
			};
			
			vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
			
			setTimeout(() => {
				const stdoutHandler = mockChild.stdout.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stdoutHandler?.(Buffer.from('/usr/bin/gh\n'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			const result = await findInPath('gh');
			
			expect(result).toBe('/usr/bin/gh');
			expect(spawn).toHaveBeenCalledWith('which', ['gh'], expect.any(Object));
		});
		
		it('should return undefined when executable not found', async () => {
			const mockChild: MockChild = {
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn(),
				kill: vi.fn()
			};
			
			vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
			
			setTimeout(() => {
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(1);
			}, 10);
			
			const result = await findInPath('nonexistent');
			
			expect(result).toBeUndefined();
		});
		
		it('should return first path when multiple paths found', async () => {
			if (process.platform === 'win32') {
				return; // Skip on Windows
			}
			
			const mockChild: MockChild = {
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn(),
				kill: vi.fn()
			};
			
			vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
			
			setTimeout(() => {
				const stdoutHandler = mockChild.stdout.on.mock.calls.find((call: unknown[]) => call[0] === 'data')?.[1];
				stdoutHandler?.(Buffer.from('/usr/bin/gh\n/usr/local/bin/gh\n'));
				
				const closeHandler = mockChild.on.mock.calls.find((call: unknown[]) => call[0] === 'close')?.[1];
				closeHandler?.(0);
			}, 10);
			
			const result = await findInPath('gh');
			
			expect(result).toBe('/usr/bin/gh');
		});
	});
});
