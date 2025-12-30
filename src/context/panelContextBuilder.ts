/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Context information for a panel discussion
 */
export interface IPanelContext {
	activeEditor?: {
		uri: vscode.Uri;
		fileName: string;
		languageId: string;
		selection: vscode.Range;
		lineCount: number;
	};
	workspace?: {
		folders: string[];
		name?: string;
	};
	diagnostics?: vscode.Diagnostic[];
	references: readonly vscode.ChatPromptReference[];
}

/**
 * Builds context information for panel discussions using VS Code public APIs
 */
export class PanelContextBuilder {
	/**
	 * Build comprehensive context from the current VS Code state
	 */
	buildContext(request: vscode.ChatRequest): IPanelContext {
		return {
			activeEditor: this.getActiveEditorInfo(),
			workspace: this.getWorkspaceInfo(),
			diagnostics: this.getDiagnostics(),
			references: request.references
		};
	}
	
	/**
	 * Get information about the active text editor
	 */
	private getActiveEditorInfo() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return undefined;
		}
		
		return {
			uri: editor.document.uri,
			fileName: path.basename(editor.document.uri.fsPath),
			languageId: editor.document.languageId,
			selection: editor.selection,
			lineCount: editor.document.lineCount
		};
	}
	
	/**
	 * Get workspace folder information
	 */
	private getWorkspaceInfo() {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			return undefined;
		}
		
		return {
			folders: folders.map(f => f.uri.fsPath),
			name: folders[0].name
		};
	}
	
	/**
	 * Get diagnostics (errors/warnings) for the active file
	 */
	private getDiagnostics(): vscode.Diagnostic[] | undefined {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return undefined;
		}
		
		return vscode.languages.getDiagnostics(editor.document.uri);
	}
}
