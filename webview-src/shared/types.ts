/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Lightweight shape of a flow entry as sent from the extension host to the
 * gallery webview via postMessage. Mirrors IFlowEntry from flowLibrary.ts but
 * has no VS Code or Node.js dependencies so it is safe to import in the browser bundle.
 */
export interface IFlowEntryMessage {
	id: string;
	name: string;
	description?: string;
	category?: string;
	subcategory?: string;
	tags?: string[];
	difficulty?: string;
	version?: string;
	author?: string;
	tutorialUrl?: string;
	source: 'builtin';
}
