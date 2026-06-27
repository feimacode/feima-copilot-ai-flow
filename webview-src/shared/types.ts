/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Source of a flow entry (mirrors FlowSource from flowSource.ts).
 */
export type FlowSource = 'builtin' | 'catalog' | 'workspace';

/**
 * Lightweight shape of a flow entry as sent from the extension host to the
 * gallery webview via postMessage. Mirrors IFlowEntry from flowSource.ts but
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
	source: FlowSource;

	/** Number of roles in the flow */
	roleCount?: number;
	/** Orchestration pattern: sequence, staged, or fork-join */
	orchestration?: 'sequence' | 'staged' | 'fork-join';
	/** URL to the flow's gist or GitHub repository (for star button) */
	sourceUrl?: string;
	/** Aggregate star count from catalog index */
	starCount?: number;
	/** True when the flow lives in the workspace (editable & persistent). False for builtin/catalog. */
	canEdit?: boolean;
	/** Local file path (for builtin and workspace flows; undefined for catalog) */
	filePath?: string;
	/** Raw YAML content for the compact preview. Sent eagerly for all flows. */
	yamlContent?: string;
}
