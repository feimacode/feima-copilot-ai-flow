#!/usr/bin/env node

/**
 * validate-index.js — Validate index.json against the catalog schema.
 *
 * Usage: node scripts/validate-index.js <path-to-index.json>
 *
 * Exits with code 0 on success, 1 on validation failure.
 */

const fs = require('fs');
const path = require('path');

const indexFile = process.argv[2];
if (!indexFile) {
	console.error('Usage: node scripts/validate-index.js <path-to-index.json>');
	process.exit(1);
}

const indexPath = path.resolve(indexFile);
if (!fs.existsSync(indexPath)) {
	console.error(`File not found: ${indexPath}`);
	process.exit(1);
}

let index;
try {
	index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
} catch (err) {
	console.error(`Failed to parse JSON: ${err.message}`);
	process.exit(1);
}

const errors = [];

// Validate top-level structure
if (!index.version || typeof index.version !== 'number') {
	errors.push('Missing or invalid "version" field (must be a number)');
}
if (!index.updated || typeof index.updated !== 'string') {
	errors.push('Missing or invalid "updated" field (must be an ISO 8601 string)');
}
if (!Array.isArray(index.providers)) {
	errors.push('Missing or invalid "providers" field (must be an array)');
}
if (!Array.isArray(index.skills)) {
	errors.push('Missing or invalid "skills" field (must be an array)');
}
if (!Array.isArray(index.prompts)) {
	errors.push('Missing or invalid "prompts" field (must be an array)');
}
if (!Array.isArray(index.flows)) {
	errors.push('Missing or invalid "flows" field (must be an array)');
}

// Validate flow entries
if (Array.isArray(index.flows)) {
	const requiredFlowFields = ['id', 'name', 'description', 'source', 'tags', 'orchestration', 'roles', 'type', 'provider'];
	const validOrchestrations = ['sequence', 'staged', 'fork-join'];

	for (let i = 0; i < index.flows.length; i++) {
		const flow = index.flows[i];
		const prefix = `flows[${i}] (${flow.id || 'unknown'})`;

		for (const field of requiredFlowFields) {
			if (flow[field] === undefined || flow[field] === null) {
				errors.push(`${prefix}: missing required field "${field}"`);
			}
		}

		if (flow.type !== 'flow') {
			errors.push(`${prefix}: type must be "flow", got "${flow.type}"`);
		}

		if (flow.orchestration && !validOrchestrations.includes(flow.orchestration)) {
			errors.push(`${prefix}: invalid orchestration "${flow.orchestration}" (must be one of: ${validOrchestrations.join(', ')})`);
		}

		if (flow.roles !== undefined && (typeof flow.roles !== 'number' || flow.roles < 1)) {
			errors.push(`${prefix}: "roles" must be a positive integer`);
		}

		if (flow.tags && !Array.isArray(flow.tags)) {
			errors.push(`${prefix}: "tags" must be an array`);
		}
	}
}

// Validate skill entries
if (Array.isArray(index.skills)) {
	const requiredSkillFields = ['id', 'name', 'description', 'source', 'tags', 'type', 'provider'];

	for (let i = 0; i < index.skills.length; i++) {
		const skill = index.skills[i];
		const prefix = `skills[${i}] (${skill.id || 'unknown'})`;

		for (const field of requiredSkillFields) {
			if (skill[field] === undefined || skill[field] === null) {
				errors.push(`${prefix}: missing required field "${field}"`);
			}
		}

		if (skill.type !== 'skill') {
			errors.push(`${prefix}: type must be "skill", got "${skill.type}"`);
		}
	}
}

// Validate prompt entries
if (Array.isArray(index.prompts)) {
	const requiredPromptFields = ['id', 'name', 'description', 'source', 'tags', 'type', 'provider'];

	for (let i = 0; i < index.prompts.length; i++) {
		const prompt = index.prompts[i];
		const prefix = `prompts[${i}] (${prompt.id || 'unknown'})`;

		for (const field of requiredPromptFields) {
			if (prompt[field] === undefined || prompt[field] === null) {
				errors.push(`${prefix}: missing required field "${field}"`);
			}
		}

		if (prompt.type !== 'prompt') {
			errors.push(`${prefix}: type must be "prompt", got "${prompt.type}"`);
		}
	}
}

if (errors.length > 0) {
	console.error(`Validation failed with ${errors.length} error(s):`);
	for (const err of errors) {
		console.error(`  - ${err}`);
	}
	process.exit(1);
}

console.log(`✓ Valid index.json (${index.flows.length} flows, ${index.skills.length} skills, ${index.prompts.length} prompts)`);
process.exit(0);
