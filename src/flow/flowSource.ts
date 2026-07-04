/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { ICatalogFlow } from './catalogClient';
import { resolveSourceUri } from './sourceUriResolver';

/**
 * Resolves a catalog source URI to a browser-friendly URL for the star button.
 * Converts "gist:abc123" → "https://gist.github.com/abc123"
 * Converts "github:owner/repo/path" → "https://github.com/owner/repo/blob/main/path"
 */
function resolveSourceUrlToUrl(sourceUri: string): string {
	const colonIndex = sourceUri.indexOf(':');
	if (colonIndex === -1) {
		return '';
	}

	const scheme = sourceUri.substring(0, colonIndex);
	const value = sourceUri.substring(colonIndex + 1);

	if (scheme === 'gist') {
		return `https://gist.github.com/${value}`;
	} else if (scheme === 'github') {
		return `https://github.com/${value.replace(/:/, '/blob/main/')}`;
	}

	return '';
}

/**
 * Source of a flow entry.
 *
 * - `builtin`: Bundled in the extension's examples/ directory (pedagogical, playground use)
 * - `catalog`: From the harness catalog index.json (production-ready, installable)
 * - `workspace`: Installed in the user's workspace .github/flows/ directory
 */
export type FlowSource = 'builtin' | 'catalog' | 'workspace';

/**
 * Unified flow entry interface used by FlowLibrary.
 * Represents a flow from any source with metadata for display and installation.
 */
export interface IFlowEntry {
	/** Unique identifier (filename without extension or catalog id) */
	id: string;
	/** Display name */
	name: string;
	/** Description */
	description?: string;
	/** Category (e.g., "software-development", "operations") */
	category?: string;
	/** Subcategory (e.g., "code-quality", "incident-response") */
	subcategory?: string;
	/** Tags for search and filtering */
	tags?: readonly string[];
	/** Difficulty level */
	difficulty?: 'beginner' | 'intermediate' | 'advanced';
	/** Version string */
	version?: string;
	/** Author name */
	author?: string;
	/** Tutorial URL */
	tutorialUrl?: string;

	/** Source of this flow */
	source: FlowSource;

	/** Local file path (for builtin and workspace flows) */
	filePath?: string;

	/** Remote source URI (for catalog flows, e.g., "gist:abc123" or "github:owner/repo/path") */
	sourceUri?: string;

	/** Provider name (for catalog flows, e.g., "feima-awesome-harness") */
	provider?: string;

	/** Trust level (for catalog flows) */
	trust?: 'official' | 'community';

	/** Orchestration pattern (for catalog flows) */
	orchestration?: 'sequence' | 'staged' | 'fork-join';

	/** Number of roles (for catalog flows) */
	roleCount?: number;

	/** Companion skills referenced by this flow (for catalog flows) */
	usesSkills?: readonly string[];

	/** Companion prompts/agents referenced by this flow (for catalog flows) */
	usesPrompts?: readonly string[];

	/** URL to the flow's gist or GitHub repository (for star button) */
	sourceUrl?: string;

	/** Aggregate star count from catalog index */
	starCount?: number;

	/** Full sharedContext text from the flow YAML (What/When/How/Example/Customize). */
	sharedContext?: string;
}

/**
 * Converts a catalog flow entry to IFlowEntry format.
 */
export function catalogFlowToEntry(flow: ICatalogFlow, provider: string, trust: 'official' | 'community'): IFlowEntry {
	return {
		id: flow.id,
		name: flow.name,
		description: flow.description,
		tags: flow.tags,
		category: flow.category,
		source: 'catalog',
		sourceUri: flow.source,
		provider: provider,
		trust: trust,
		orchestration: flow.orchestration,
		roleCount: flow.roles,
		usesSkills: flow.uses_skills,
		usesPrompts: flow.uses_prompts,
		// sourceUrl is resolved from sourceUri (e.g., "gist:abc123" → "https://gist.github.com/abc123")
		sourceUrl: resolveSourceUrlToUrl(flow.source),
		// starCount would be fetched from gist/github API, but for now we set to 0
		starCount: 0,
	};
}

