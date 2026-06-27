/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFlowEntry } from './flowSource';
import { FlowSourceBase } from './flowSourceBase';

/**
 * WorkspaceSource provides flows installed in the user's workspace .github/flows/ directory.
 * These are production-ready flows that have been installed from the catalog.
 */
export class WorkspaceSource extends FlowSourceBase {
	private watcher: vscode.FileSystemWatcher | undefined;

	/**
	 * Watch for changes to .github/flows/ directory.
	 */
	watch(onChange: () => void): vscode.Disposable {
		if (this.watcher) {
			return this.watcher;
		}

		const root = vscode.workspace.workspaceFolders?.[0] || vscode.Uri.file('/');
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(root, '.github/flows/*.flow.yaml')
		);

		const invalidate = () => { this.entries = undefined; onChange(); };
		this.watcher.onDidCreate(invalidate);
		this.watcher.onDidDelete(invalidate);
		this.watcher.onDidChange(invalidate);

		return this.watcher;
	}

	dispose(): void {
		this.watcher?.dispose();
	}

	protected async load(): Promise<IFlowEntry[]> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return [];
		}

		const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		const results: IFlowEntry[] = [];

		try {
			const entries = await vscode.workspace.fs.readDirectory(flowsDir);
			for (const [name, type] of entries) {
				if (type !== vscode.FileType.File || !name.endsWith('.flow.yaml')) {
					continue;
				}

				const filePath = vscode.Uri.joinPath(flowsDir, name);
				const id = name.replace(/\.flow\.yaml$/, '');
				const metadata = await FlowSourceBase.parseMetadata(filePath);
				results.push(FlowSourceBase.entryFromMetadata(id, metadata, 'workspace', filePath.fsPath));
			}
		} catch (error) {
			if ((error as vscode.FileSystemError)?.code !== 'FileNotFound') {
				console.warn('WorkspaceSource: Failed to scan .github/flows directory:', error);
			}
		}

		return results;
	}
}
