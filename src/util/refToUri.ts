/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Extract a URI from a ChatPromptReference using duck-typing.
 * `instanceof vscode.Uri` can fail across the VS Code extension host proxy,
 * so we use structural checks instead.
 */
export function refToUri(ref: vscode.ChatPromptReference): vscode.Uri | undefined {
	const v = ref.value;
	if (v && typeof v === 'object') {
		if ('scheme' in v && 'path' in v) {
			try { return vscode.Uri.from(v as vscode.Uri); } catch { /* ignore */ }
		}
		if ('uri' in v && 'range' in v) {
			const loc = v as { uri: unknown };
			if (loc.uri && typeof loc.uri === 'object' && 'scheme' in loc.uri && 'path' in loc.uri) {
				try { return vscode.Uri.from(loc.uri as vscode.Uri); } catch { /* ignore */ }
			}
		}
	}
	if (typeof ref.id === 'string' && ref.id.startsWith('file:')) {
		try { return vscode.Uri.parse(ref.id, /*strict*/ true); } catch { /* ignore */ }
	}
	return undefined;
}
