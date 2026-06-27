/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFlowEntry } from './flowSource';
import { FlowSourceBase } from './flowSourceBase';

/**
 * BuiltinSource provides flows bundled with the extension in the examples/ directory.
 * These are pedagogical examples meant for playground use, not production.
 */
export class BuiltinSource extends FlowSourceBase {

	constructor(private readonly extensionUri: vscode.Uri) {
		super();
	}

	protected async load(): Promise<IFlowEntry[]> {
		const examplesDir = vscode.Uri.joinPath(this.extensionUri, 'examples');
		const results: IFlowEntry[] = [];

		try {
			const entries = await vscode.workspace.fs.readDirectory(examplesDir);
			for (const [name, type] of entries) {
				if (type !== vscode.FileType.File || !name.endsWith('.flow.yaml')) {
					continue;
				}

				const filePath = vscode.Uri.joinPath(examplesDir, name);
				const id = name.replace(/\.flow\.yaml$/, '');
				const metadata = await FlowSourceBase.parseMetadata(filePath);
				results.push(FlowSourceBase.entryFromMetadata(id, metadata, 'builtin', filePath.fsPath));
			}
		} catch (error) {
			console.warn('BuiltinSource: Failed to scan examples directory:', error);
		}

		return results;
	}
}
