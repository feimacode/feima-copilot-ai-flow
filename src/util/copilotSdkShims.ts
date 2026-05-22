/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for setting up required shims for GitHub Copilot SDK
 * 
 * The SDK requires:
 * - node-pty: Terminal emulation for CLI interactions
 * - ripgrep: Fast workspace search functionality
 * 
 * These are copied from VS Code's app root to the extension's globalStorage
 * to ensure the SDK can load them at runtime.
 */
export class CopilotSdkShims {
	private shimsInitialized = false;
	private shimsDirectory: vscode.Uri | undefined;
	
	constructor(
		private readonly context: vscode.ExtensionContext
	) {}
	
	/**
	 * Ensure all required shims are set up
	 * This should be called before any SDK operations
	 */
	async ensureShims(): Promise<void> {
		if (this.shimsInitialized) {
			return;
		}
		
		try {
			// Get or create shims directory in globalStorage
			this.shimsDirectory = vscode.Uri.joinPath(
				this.context.globalStorageUri,
				'copilotCli'
			);
			
			await vscode.workspace.fs.createDirectory(this.shimsDirectory);
			
			// Set up node-pty shim
			await this.setupNodePtyShim();
			
			// Set up ripgrep shim
			await this.setupRipgrepShim();
			
			this.shimsInitialized = true;
			console.log('[CopilotSdkShims] All shims initialized successfully');
			
		} catch (error) {
			console.error('[CopilotSdkShims] Failed to initialize shims:', error);
			throw new Error(`Failed to initialize SDK shims: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	
	/**
	 * Set up node-pty shim for terminal emulation
	 */
	private async setupNodePtyShim(): Promise<void> {
		if (!this.shimsDirectory) {
			throw new Error('Shims directory not initialized');
		}
		
		// VS Code includes node-pty in its app root
		// We need to copy it to our extension storage
		const vscodeAppRoot = vscode.env.appRoot;
		
		// Platform-specific node-pty locations
		let nodePtySource: string;
		if (process.platform === 'win32') {
			nodePtySource = path.join(vscodeAppRoot, 'node_modules', 'node-pty', 'build', 'Release', 'pty.node');
		} else if (process.platform === 'darwin') {
			nodePtySource = path.join(vscodeAppRoot, 'node_modules.asar.unpacked', 'node-pty', 'build', 'Release', 'pty.node');
		} else {
			// Linux
			nodePtySource = path.join(vscodeAppRoot, 'node_modules.asar.unpacked', 'node-pty', 'build', 'Release', 'pty.node');
		}
		
		// Check if source exists
		if (!fs.existsSync(nodePtySource)) {
			console.warn(`[CopilotSdkShims] node-pty not found at ${nodePtySource}`);
			// Try alternative location
			const altSource = path.join(vscodeAppRoot, 'node_modules', 'node-pty', 'build', 'Release', 'pty.node');
			if (fs.existsSync(altSource)) {
				nodePtySource = altSource;
			} else {
				throw new Error(`node-pty not found in VS Code installation at: ${nodePtySource} or ${altSource}`);
			}
		}
		
		// Copy to shims directory
		const nodePtyDest = vscode.Uri.joinPath(this.shimsDirectory, 'node-pty');
		await vscode.workspace.fs.createDirectory(nodePtyDest);
		
		const nodePtyDestFile = vscode.Uri.joinPath(nodePtyDest, 'pty.node');
		const sourceData = await fs.promises.readFile(nodePtySource);
		await vscode.workspace.fs.writeFile(nodePtyDestFile, sourceData);
		
		console.log('[CopilotSdkShims] node-pty shim created successfully');
	}
	
	/**
	 * Set up ripgrep shim for workspace search
	 */
	private async setupRipgrepShim(): Promise<void> {
		if (!this.shimsDirectory) {
			throw new Error('Shims directory not initialized');
		}
		
		const vscodeAppRoot = vscode.env.appRoot;
		
		// Platform-specific ripgrep executable names
		let rgExecutableName: string;
		if (process.platform === 'win32') {
			rgExecutableName = 'rg.exe';
		} else {
			rgExecutableName = 'rg';
		}
		
		// VS Code includes ripgrep in node_modules/@vscode/ripgrep/bin/
		const rgSource = path.join(vscodeAppRoot, 'node_modules', '@vscode', 'ripgrep', 'bin', rgExecutableName);
		
		// Check if source exists
		if (!fs.existsSync(rgSource)) {
			// Try alternative asar unpacked location
			const altSource = path.join(vscodeAppRoot, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', rgExecutableName);
			if (!fs.existsSync(altSource)) {
				throw new Error(`ripgrep not found in VS Code installation at: ${rgSource} or ${altSource}`);
			}
			
			// Copy from alternative location
			const rgDest = vscode.Uri.joinPath(this.shimsDirectory, 'ripgrep');
			await vscode.workspace.fs.createDirectory(rgDest);
			
			const rgDestFile = vscode.Uri.joinPath(rgDest, rgExecutableName);
			const sourceData = await fs.promises.readFile(altSource);
			await vscode.workspace.fs.writeFile(rgDestFile, sourceData);
			
			// Make executable on Unix-like systems
			if (process.platform !== 'win32') {
				await fs.promises.chmod(rgDestFile.fsPath, 0o755);
			}
		} else {
			// Copy to shims directory
			const rgDest = vscode.Uri.joinPath(this.shimsDirectory, 'ripgrep');
			await vscode.workspace.fs.createDirectory(rgDest);
			
			const rgDestFile = vscode.Uri.joinPath(rgDest, rgExecutableName);
			const sourceData = await fs.promises.readFile(rgSource);
			await vscode.workspace.fs.writeFile(rgDestFile, sourceData);
			
			// Make executable on Unix-like systems
			if (process.platform !== 'win32') {
				await fs.promises.chmod(rgDestFile.fsPath, 0o755);
			}
		}
		
		console.log('[CopilotSdkShims] ripgrep shim created successfully');
	}
	
	/**
	 * Get the path to the shims directory
	 */
	getShimsDirectory(): vscode.Uri | undefined {
		return this.shimsDirectory;
	}
	
	/**
	 * Check if shims are initialized
	 */
	isInitialized(): boolean {
		return this.shimsInitialized;
	}
}
