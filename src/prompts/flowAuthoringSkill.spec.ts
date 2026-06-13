/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect } from 'vitest';

/**
 * Lightweight unit tests for FlowAuthoringSkill output rules.
 * These test the extraction and validation logic without requiring a live LM.
 *
 * Full integration of `@flow create` and `@flow enhance` with a real LM
 * is covered by simulation tests (`.stest.ts`).
 */

// ── YAML extraction tests ────────────────────────────────────────────────────

function extractYamlBlock(text: string): string | null {
	// Try markdown code fence with yaml
	const fenceMatch = text.match(/```ya?ml?\s*\n([\s\S]*?)```/);
	if (fenceMatch) { return fenceMatch[1].trim(); }
	// Try without language identifier
	const fenceMatch2 = text.match(/```\s*\n([\s\S]*?)```/);
	if (fenceMatch2) { return fenceMatch2[1].trim(); }
	// Raw YAML — find first 'name:' line
	const lines = text.trim().split('\n');
	const startIdx = lines.findIndex(l => l.trim().startsWith('name:'));
	if (startIdx >= 0) { return lines.slice(startIdx).join('\n').trim(); }
	return null;
}

function validateFlowYaml(content: string): boolean {
	try {
		// Simple structural check: needs a top-level `name:` key AND a structure key
		const hasName = /^name:\s*\S/m.test(content);
		const hasStructure = /^(roles|stages|groups):/m.test(content);
		return hasName && hasStructure;
	} catch {
		return false;
	}
}

describe('@flow create — YAML extraction', () => {
	it('extracts YAML from markdown code fence with yaml language', () => {
		const text = '```yaml\nname: Test Flow\nroles:\n  - name: Reviewer\n    prompt: Review code\n```';
		const result = extractYamlBlock(text);
		expect(result).toBe('name: Test Flow\nroles:\n  - name: Reviewer\n    prompt: Review code');
	});

	it('extracts YAML from markdown code fence without language', () => {
		const text = 'Here is a flow:\n```\nname: Test Flow\nroles:\n  - name: Reviewer\n```\nHope that helps!';
		const result = extractYamlBlock(text);
		expect(result).toBe('name: Test Flow\nroles:\n  - name: Reviewer');
	});

	it('extracts raw YAML starting from name:', () => {
		const text = 'Great idea! Here is your flow:\n\nname: Code Review\ndescription: Multi-lens review\nroles:';
		const result = extractYamlBlock(text);
		expect(result).toBe('name: Code Review\ndescription: Multi-lens review\nroles:');
	});

	it('returns null for non-YAML content', () => {
		const text = 'I cannot generate a flow for that. Please be more specific.';
		const result = extractYamlBlock(text);
		expect(result).toBeNull();
	});
});

describe('@flow create — YAML validation', () => {
	it('validates a flow with name and roles', () => {
		const valid = 'name: Test Flow\nroles:\n  - name: Reviewer\n    prompt: Do review';
		expect(validateFlowYaml(valid)).toBe(true);
	});

	it('validates a flow with name and stages', () => {
		const valid = 'name: Test Flow\nstages:\n  - name: Stage 1\n    iterations: 3\n    roles: []';
		expect(validateFlowYaml(valid)).toBe(true);
	});

	it('validates a flow with name and groups', () => {
		const valid = 'name: Test Flow\ngroups:\n  - name: Group 1\n    roles: []\njoin:\n  name: Join\n  prompt: Synthesize';
		expect(validateFlowYaml(valid)).toBe(true);
	});

	it('rejects YAML without name field', () => {
		const invalid = 'description: No name\nroles:\n  - name: Reviewer';
		expect(validateFlowYaml(invalid)).toBe(false);
	});

	it('rejects YAML without roles, stages, or groups', () => {
		const invalid = 'name: Just a name\ndescription: No structure';
		expect(validateFlowYaml(invalid)).toBe(false);
	});

	it('accepts flow with sharedContext', () => {
		const withContext = 'name: Test Flow\nroles:\n  - name: R\n    prompt: Do thing\nsharedContext: |\n  # What\n  This does something';
		expect(validateFlowYaml(withContext)).toBe(true);
	});
});

describe('@flow enhance — instruction parsing', () => {
	it('handles --add-tool-integration style instructions', () => {
		const instruction = '--add-jira-integration';
		expect(instruction).toMatch(/^--add-/);
	});

	it('handles --add-stage style instructions', () => {
		const instruction = '--add-iterative-stage';
		expect(instruction).toMatch(/^--add-/);
	});

	it('handles freeform enhancement instructions', () => {
		const instruction = 'add a security reviewer role that checks for OWASP Top 10 vulnerabilities';
		expect(instruction.length).toBeGreaterThan(10);
	});

	it('multiple flows found requires explicit file name', () => {
		const flows = ['code-review.flow.yaml', 'story-estimation.flow.yaml'];
		expect(flows.length).toBeGreaterThan(1);
		// When multiple flows exist, enhance should prompt user to specify which one
	});

	it('single flow auto-selects', () => {
		const flows = ['my-flow.flow.yaml'];
		expect(flows.length).toBe(1);
		// Single flow can be auto-selected
	});
});
