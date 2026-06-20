/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSourceUri, fetchFlow } from './sourceUriResolver';

/**
 * Unit tests for source URI resolution and flow fetching.
 */

describe('resolveSourceUri', () => {
	it('resolves gist: URI to gist.githubusercontent.com', () => {
		const result = resolveSourceUri('gist:abc123def456');
		expect(result.scheme).toBe('gist');
		expect(result.url).toBe('https://gist.githubusercontent.com/abc123def456/raw');
		expect(result.original).toBe('gist:abc123def456');
	});

	it('resolves github: URI to raw.githubusercontent.com', () => {
		const result = resolveSourceUri('github:feimacode/feima-awesome-harness/flows/code-review.flow.yaml');
		expect(result.scheme).toBe('github');
		expect(result.url).toBe('https://raw.githubusercontent.com/feimacode/feima-awesome-harness/main/flows/code-review.flow.yaml');
	});

	it('throws on unsupported scheme', () => {
		expect(() => resolveSourceUri('ftp://example.com/file.yaml')).toThrow('Unsupported source URI scheme');
	});

	it('throws on malformed gist ID', () => {
		expect(() => resolveSourceUri('gist:abc-123')).toThrow('Invalid gist ID');
	});

	it('throws on github URI with missing parts', () => {
		expect(() => resolveSourceUri('github:owner/repo')).toThrow('Invalid GitHub source URI');
	});

	it('throws on empty source URI', () => {
		expect(() => resolveSourceUri('')).toThrow('Invalid source URI');
	});
});

describe('fetchFlow', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches and validates a valid flow YAML', async () => {
		const yaml = `name: Test Flow\nroles:\n  - name: tester\n    prompt: test it`;
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => yaml,
		});

		const result = await fetchFlow('gist:abc123');
		expect(result.content).toBe(yaml);
		expect(result.source.scheme).toBe('gist');
	});

	it('throws on HTTP error', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			text: async () => '',
		});

		await expect(fetchFlow('gist:abc123')).rejects.toThrow('Failed to fetch flow');
	});

	it('throws on invalid YAML missing name', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => 'roles:\n  - name: tester',
		});

		await expect(fetchFlow('gist:abc123')).rejects.toThrow('missing required "name" field');
	});

	it('throws on invalid YAML missing roles/stages/groups', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => 'name: Test Flow',
		});

		await expect(fetchFlow('gist:abc123')).rejects.toThrow('must have at least one of "roles", "stages", or "groups"');
	});

	it('throws on empty response', async () => {
		(globalThis.fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => '',
		});

		await expect(fetchFlow('gist:abc123')).rejects.toThrow('Fetched empty content');
	});
});
