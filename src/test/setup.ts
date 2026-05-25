/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { vi } from 'vitest';
import path from 'path';

// Mock the vscode module for all tests
// Use factory function to avoid hoisting issues
vi.mock('vscode', async () => {
	const vscodeShimPath = path.resolve(__dirname, './vscode-shim');
	const vscodeShim = await import(vscodeShimPath);
	return vscodeShim;
});
