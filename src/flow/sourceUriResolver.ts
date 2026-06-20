/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

/**
 * Supported source URI schemes for catalog flow resolution.
 */
export type SourceUriScheme = 'gist' | 'github';

/**
 * Resolved source URI with the raw content URL and metadata.
 */
export interface IResolvedSource {
	/** The raw content URL to fetch the flow YAML from */
	url: string;
	/** The scheme used (gist or github) */
	scheme: SourceUriScheme;
	/** Original source URI string */
	original: string;
}

/**
 * Result of fetching a flow from a source URI.
 */
export interface IFetchFlowResult {
	/** The raw YAML content */
	content: string;
	/** The resolved source info */
	source: IResolvedSource;
}

/** Timeout for fetching flow YAML from remote sources */
const FETCH_FLOW_TIMEOUT_MS = 15_000; // 15 seconds

/**
 * Resolves a catalog source URI to a raw content URL.
 *
 * Supported schemes:
 * - `gist:<id>` → `https://gist.githubusercontent.com/<id>/raw`
 * - `github:<owner>/<repo>/<path>` → `https://raw.githubusercontent.com/<owner>/<repo>/main/<path>`
 *
 * @param sourceUri - The source URI from the catalog entry (e.g., "gist:abc123" or "github:owner/repo/path/file.yaml")
 * @returns Resolved source with raw URL
 * @throws If the scheme is unsupported or the URI is malformed
 */
export function resolveSourceUri(sourceUri: string): IResolvedSource {
	const colonIndex = sourceUri.indexOf(':');
	if (colonIndex === -1) {
		throw new Error(`Invalid source URI: "${sourceUri}". Expected format: "scheme:value"`);
	}

	const scheme = sourceUri.substring(0, colonIndex) as SourceUriScheme;
	const value = sourceUri.substring(colonIndex + 1);

	if (!value) {
		throw new Error(`Invalid source URI: "${sourceUri}". Missing value after scheme.`);
	}

	switch (scheme) {
		case 'gist':
			return resolveGistUri(value, sourceUri);
		case 'github':
			return resolveGithubUri(value, sourceUri);
		default:
			throw new Error(
				`Unsupported source URI scheme: "${scheme}". ` +
				`Supported schemes: gist:, github:`
			);
	}
}

/**
 * Resolves a gist: URI to a raw gist content URL.
 *
 * Format: gist:<gist-id>
 * Resolves to: https://gist.githubusercontent.com/<gist-id>/raw
 */
function resolveGistUri(gistId: string, original: string): IResolvedSource {
	// Validate gist ID format (alphanumeric, typically 32 chars)
	if (!/^[a-zA-Z0-9]+$/.test(gistId)) {
		throw new Error(`Invalid gist ID: "${gistId}". Expected alphanumeric characters only.`);
	}

	return {
		url: `https://gist.githubusercontent.com/${gistId}/raw`,
		scheme: 'gist',
		original,
	};
}

/**
 * Resolves a github: URI to a raw.githubusercontent.com URL.
 *
 * Format: github:<owner>/<repo>/<path>
 * Resolves to: https://raw.githubusercontent.com/<owner>/<repo>/main/<path>
 */
function resolveGithubUri(repoPath: string, original: string): IResolvedSource {
	// Expected format: owner/repo/path/to/file.yaml
	const parts = repoPath.split('/');
	if (parts.length < 3) {
		throw new Error(
			`Invalid GitHub source URI: "${original}". ` +
			`Expected format: "github:owner/repo/path/to/file.yaml"`
		);
	}

	const owner = parts[0];
	const repo = parts[1];
	const path = parts.slice(2).join('/');

	if (!owner || !repo || !path) {
		throw new Error(
			`Invalid GitHub source URI: "${original}". ` +
			`Owner, repo, and path are all required.`
		);
	}

	return {
		url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`,
		scheme: 'github',
		original,
	};
}

/**
 * Fetches flow YAML content from a resolved source URI.
 *
 * @param sourceUri - The catalog source URI (e.g., "gist:abc123" or "github:owner/repo/path/file.yaml")
 * @returns The fetched flow content and resolved source info
 * @throws If the URI is invalid, the fetch fails, or the content is not valid YAML
 */
export async function fetchFlow(sourceUri: string): Promise<IFetchFlowResult> {
	const resolved = resolveSourceUri(sourceUri);

	// Create an AbortController for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_FLOW_TIMEOUT_MS);

	try {
		const response = await fetch(resolved.url, {
			signal: controller.signal,
			headers: {
				'Accept': 'text/plain, application/x-yaml, */*',
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch flow from ${resolved.url}: ` +
				`HTTP ${response.status} ${response.statusText}`
			);
		}

		const content = await response.text();

		if (!content || content.trim().length === 0) {
			throw new Error(`Fetched empty content from ${resolved.url}`);
		}

		// Validate that it's valid YAML with a name field
		validateFlowYaml(content, sourceUri);

		return { content, source: resolved };
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(
				`Fetch timed out after ${FETCH_FLOW_TIMEOUT_MS / 1000}s: ${resolved.url}`
			);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Validates that the fetched content is valid YAML and looks like a flow file.
 *
 * @param content - The raw YAML content to validate
 * @param sourceUri - The source URI for error messages
 * @throws If the content is not valid YAML or doesn't have required flow fields
 */
function validateFlowYaml(content: string, sourceUri: string): void {
	let doc: unknown;
	try {
		doc = yaml.load(content);
	} catch (error) {
		throw new Error(
			`Invalid YAML in flow from "${sourceUri}": ` +
			`${error instanceof Error ? error.message : String(error)}`
		);
	}

	if (!doc || typeof doc !== 'object') {
		throw new Error(`Invalid flow YAML from "${sourceUri}": content is not a YAML object`);
	}

	const flowDoc = doc as Record<string, unknown>;

	// Must have a name
	if (!flowDoc.name || typeof flowDoc.name !== 'string') {
		throw new Error(
			`Invalid flow YAML from "${sourceUri}": missing required "name" field`
		);
	}

	// Must have at least one of: roles, stages, groups
	const hasRoles = Array.isArray(flowDoc.roles) && flowDoc.roles.length > 0;
	const hasStages = Array.isArray(flowDoc.stages) && flowDoc.stages.length > 0;
	const hasGroups = Array.isArray(flowDoc.groups) && flowDoc.groups.length > 0;

	if (!hasRoles && !hasStages && !hasGroups) {
		throw new Error(
			`Invalid flow YAML from "${sourceUri}": ` +
			`must have at least one of "roles", "stages", or "groups"`
		);
	}
}
