/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import type {
	IFlowDocument, IFlowRole, IFlowStage,
	ISkillRef, IAgentRef, IContextRef, IPromptRef,
	OrchestrationStrategy, IsolationMode, CliMode, SubFlowPattern,
} from '../types/flowDocument';

// Re-export the types that other modules import from here.
export type { ISkillRef, IAgentRef, IContextRef, IPromptRef } from '../types/flowDocument';
export type { IFlowRole, IFlowStage, IFlowDocument, OrchestrationStrategy, IsolationMode, CliMode, SubFlowPattern };
// Backward-compatible aliases used internally
type IRoleDefinition = IFlowRole;
type IStageDefinition = IFlowStage;

/**
 * Runtime configuration for a flow — extends the document shape with
 * VS Code-specific fields added after parsing.
 */
export interface IFlowConfig extends IFlowDocument {
	/** Flat list of roles (always present at runtime; optional only in the raw YAML). */
	readonly roles: ReadonlyArray<IFlowRole>;
	/** Shared context body (required at runtime; optional in the YAML). */
	readonly sharedContext: string;
	/** URI of the source .flow.yaml file. */
	readonly promptUri: vscode.Uri;
	/** Computed count of roles across all stages (used by the gallery view). */
	readonly rolesCount?: number;
}

/**
 * Result from a single role's response
 */
export interface IRoleResponse {
	readonly roleName: string;
	readonly content: string;
	readonly model: string;
	readonly error?: string;
	/** URIs of files created or modified by tool calls during this role's execution. */
	readonly touchedFiles?: readonly vscode.Uri[];
}

/**
 * Service for parsing and managing flow discussions
 */
export class FlowService {
	
	/**
	 * Parse a .flow.yaml file to extract flow configuration
	 */
	async parsePrompt(uri: vscode.Uri): Promise<IFlowConfig | undefined> {
		try {
			// Read the file content
			const content = await vscode.workspace.fs.readFile(uri);
			const textContent = Buffer.from(content).toString('utf8');
			
			// Parse pure YAML — no frontmatter delimiters
			const header = yaml.load(textContent) as Record<string, unknown>;
			if (typeof header !== 'object' || header === null) {
				throw new Error('Flow file must contain a valid YAML document');
			}
			
			// sharedContext is an optional YAML field
			const body = header.sharedContext ? String(header.sharedContext) : '';
			
			// Parse stages (structured mode) or flat roles (legacy mode)
			const stages = header.stages ? this.parseStages(header.stages) : undefined;
			const roles = Array.isArray(header.roles) ? this.parseRoles(header.roles) : [];
			if (!stages && roles.length < 2) {
				throw new Error('Flow requires either stages with roles or at least 2 top-level roles');
			}

			// Flow-level skills applied to all roles
			const skills = this.parseSkillRefs(header.skills);
			// Flow-level context files applied to all roles
			const contexts = this.parseContextRefs(header.contexts);

			// Extract configuration
			const orchestration = this.parseOrchestration(header.orchestration);
			const tools = this.parseTools(header.tools);
			
			// CLI-specific properties
			const isolation = this.parseIsolation(header.isolation);
			const cliMode = this.parseCliMode(header.cliMode);
			const customAgent = this.parseCustomAgent(header.customAgent);
			const model = this.parseModel(header.model);

			const totalRoles = stages
				? stages.reduce((sum, s) => sum + s.roles.length, 0)
				: roles.length;
			
			return {
				name: String(header.name || 'Untitled'),
				description: header.description ? String(header.description) : undefined,
				category: header.category ? String(header.category) : undefined,
				subcategory: header.subcategory ? String(header.subcategory) : undefined,
				tags: Array.isArray(header.tags) ? header.tags.map(String) : undefined,
				difficulty: this.parseDifficulty(header.difficulty),
				rolesCount: totalRoles,
				version: header.version ? String(header.version) : undefined,
				author: header.author ? String(header.author) : undefined,
				roles,
				stages,
				skills: skills.length > 0 ? skills : undefined,
				contexts: contexts.length > 0 ? contexts : undefined,
				orchestration,
				sharedContext: body,
				promptUri: uri,
				tools,
				isolation,
				cliMode,
				customAgent,
				model
			};
			
		} catch (error) {
			throw new Error(`Failed to parse prompt: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	
	/**
	 * Parse roles array from YAML
	 */
	private parseRoles(rolesData: unknown): IRoleDefinition[] {
		if (!Array.isArray(rolesData)) {
			throw new Error('Roles must be an array');
		}
		
		const roles: IRoleDefinition[] = [];
		
		for (const item of rolesData) {
			if (typeof item !== 'object' || item === null) {
				continue;
			}

			const role = item as Record<string, unknown>;
			const name = role.name ? String(role.name) : undefined;
			const prompt = this.parsePromptRef(role.prompt);
			const model = role.model ? String(role.model) : undefined;
			const roleSkills = this.parseSkillRefs(role.skills);
			const roleContexts = this.parseContextRefs(role.contexts);
			const agent = this.parseAgentRef(role.agent);
			const args = role.arguments ? String(role.arguments) : (role.args ? String(role.args) : undefined);

			// A role must have a name and at least one of: prompt or agent
			if (name && (prompt || agent)) {
				roles.push({
					name,
					...(prompt ? { prompt } : {}),
					...(agent ? { agent } : {}),
					...(args ? { args } : {}),
					model,
					...(roleSkills.length > 0 ? { skills: roleSkills } : {}),
					...(roleContexts.length > 0 ? { contexts: roleContexts } : {})
				});
			}
		}
		
		return roles;
	}
	
	/**
	 * Parse a prompt reference from YAML.
	 * Accepts:
	 * - Bare string → inline prompt text
	 * - Object with `uri` key → absolute URI or file path
	 * - Object with `name` key → filename searched in default Copilot prompt folders
	 */
	private parsePromptRef(value: unknown): IPromptRef | undefined {
		if (typeof value === 'string') {
			return value.trim() || undefined;
		}
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, unknown>;
			if (typeof obj.uri === 'string') {
				return { uri: String(obj.uri) };
			}
			if (typeof obj.name === 'string') {
				return { name: String(obj.name) };
			}
		}
		return undefined;
	}
	
	/**
	 * Parse a single agent reference from YAML.
	 * Accepts a bare string (name lookup) or an object with a `path` key.
	 */
	private parseAgentRef(value: unknown): IAgentRef | undefined {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
		if (typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).path === 'string') {
			return { path: String((value as Record<string, unknown>).path) };
		}
		return undefined;
	}

	/**
	 * Parse context file references from YAML.
	 * Accepts bare strings (paths relative to the flow file or workspace root)
	 * or objects with a `path` key.
	 */
	private parseContextRefs(value: unknown): IContextRef[] {
		if (!Array.isArray(value)) {
			return [];
		}
		return value.reduce<IContextRef[]>((acc, item) => {
			if (typeof item === 'string' && item.trim()) {
				acc.push(item.trim());
			} else if (typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).path === 'string') {
				acc.push({ path: String((item as Record<string, unknown>).path) });
			}
			return acc;
		}, []);
	}

	/**
	 * Parse skill references from YAML.
	 * Accepts bare strings (name lookup) or objects with a `path` key (relative path).
	 */
	private parseSkillRefs(value: unknown): ISkillRef[] {
		if (!Array.isArray(value)) {
			return [];
		}
		return value.reduce<ISkillRef[]>((acc, item) => {
			if (typeof item === 'string' && item.trim()) {
				acc.push(item.trim());
			} else if (typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).path === 'string') {
				acc.push({ path: String((item as Record<string, unknown>).path) });
			}
			return acc;
		}, []);
	}

	/**
	 * Parse sub-flow pattern, defaulting to 'sequence'
	 */
	private parseSubFlowPattern(value: unknown): SubFlowPattern {
		if (value === 'research-edit-review' || value === 'plan-execute-test-fix') {
			return value;
		}
		return 'sequence';
	}

	/**
	 * Parse stages array from YAML
	 */
	private parseStages(stagesData: unknown): IStageDefinition[] {
		if (!Array.isArray(stagesData)) {
			return [];
		}
		const stages: IStageDefinition[] = [];
		for (const item of stagesData) {
			if (typeof item !== 'object' || item === null) {
				continue;
			}
			const stage = item as Record<string, unknown>;
			const name = stage.name ? String(stage.name) : undefined;
			if (!name) {
				continue;
			}
			const subFlow = this.parseSubFlowPattern(stage.subFlow);
			const iterations = typeof stage.iterations === 'number' ? Math.max(1, stage.iterations) : 1;
			const doneWord = typeof stage.doneWord === 'string' && stage.doneWord.trim() ? stage.doneWord.trim() : undefined;
			const roles = Array.isArray(stage.roles) ? this.parseRoles(stage.roles) : [];
			const stageSkills = this.parseSkillRefs(stage.skills);
			const stageContexts = this.parseContextRefs(stage.contexts);
			if (roles.length >= 1) {
				stages.push({
					name,
					subFlow,
					iterations,
					...(doneWord ? { doneWord } : {}),
					roles,
					...(stageSkills.length > 0 ? { skills: stageSkills } : {}),
					...(stageContexts.length > 0 ? { contexts: stageContexts } : {})
				});
			}
		}
		return stages;
	}

	/**
	 * Parse orchestration strategy
	 */
	private parseOrchestration(value: unknown): OrchestrationStrategy {
		if (typeof value === 'string') {
			if (value === 'sequence' || value === 'cli') {
				return value;
			}
			// Support legacy values for backward compatibility during development
			if (value === 'sequential') {
				return 'sequence';
			}
			if (value === 'all-respond') {
				return 'cli';
			}
		}
		return 'sequence'; // default
	}
	
	/**
	 * Parse difficulty level
	 */
	private parseDifficulty(value: unknown): 'beginner' | 'intermediate' | 'advanced' | undefined {
		if (typeof value === 'string') {
			if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
				return value;
			}
		}
		return undefined;
	}
	
	/**
	 * Parse isolation mode from YAML
	 */
	private parseIsolation(value: unknown): IsolationMode | undefined {
		if (typeof value === 'string') {
			if (value === 'workspace' || value === 'worktree') {
				return value;
			}
		}
		return undefined;
	}
	
	/**
	 * Parse CLI mode from YAML
	 */
	private parseCliMode(value: unknown): CliMode | undefined {
		if (typeof value === 'string') {
			if (value === 'supervised' || value === 'autonomous') {
				return value;
			}
		}
		return undefined;
	}
	
	/**
	 * Parse custom agent from YAML
	 */
	private parseCustomAgent(value: unknown): string | undefined {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
		return undefined;
	}
	
	/**
	 * Parse model from YAML
	 */
	private parseModel(value: unknown): string | undefined {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
		return undefined;
	}
	
	/**
	 * Parse tools array from YAML
	 * Supports wildcard '*' to include all available tools
	 */
	private parseTools(value: unknown): string[] | undefined {
		if (!Array.isArray(value)) {
			return undefined;
		}
		
		const tools = value
			.filter(item => typeof item === 'string')
			.map(item => String(item));
		
		// Check for wildcard - indicates all tools should be included
		if (tools.includes('*')) {
			return ['*'];
		}
		
		return tools;
	}
	
	/**
	 * Format role responses for display
	 */
	formatResponses(responses: ReadonlyArray<IRoleResponse>): string {
		let output = '';
		
		for (const response of responses) {
			output += `### ${response.roleName}\n\n`;
			
			if (response.error) {
				output += `*Error: ${response.error}*\n\n`;
			} else {
				output += `${response.content}\n\n`;
			}
			
			if (response.model) {
				output += `*<sub>Model: ${response.model}</sub>*\n\n`;
			}
			
			output += '---\n\n';
		}
		
		return output;
	}
	
	/**
	 * Validate a flow configuration
	 */
	validate(config: IFlowConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (config.stages) {
			// Stage-based validation
			if (config.stages.length === 0) {
				errors.push('At least one stage is required');
			}
			for (const stage of config.stages) {
				if (!stage.name.trim()) {
					errors.push('Stage name cannot be empty');
				}
				if (stage.roles.length === 0) {
					errors.push(`Stage "${stage.name}" must have at least one role`);
				}
				for (const role of stage.roles) {
					if (!role.name.trim()) {
						errors.push(`Stage "${stage.name}": role name cannot be empty`);
					}
					if (!role.prompt && !role.agent) {
						errors.push(`Stage "${stage.name}", role "${role.name}": must have prompt or agent`);
					}
				}
			}
		} else {
			// Flat role validation (legacy)
			if (config.roles.length < 2) {
				errors.push('At least 2 roles are required');
			}
			if (config.roles.length > 10) {
				errors.push('Maximum 10 roles allowed');
			}
			const roleNames = new Set<string>();
			for (const role of config.roles) {
				if (!role.name.trim()) {
					errors.push('Role name cannot be empty');
				}
				if (roleNames.has(role.name)) {
					errors.push(`Duplicate role name: ${role.name}`);
				}
				roleNames.add(role.name);
				if (!role.prompt && !role.agent) {
					errors.push(`Role "${role.name}" must have a prompt or agent`);
				}
			}
		}
		
		// Validate CLI-specific properties
		if (config.orchestration === 'cli') {
			if (config.isolation && config.isolation !== 'workspace' && config.isolation !== 'worktree') {
				errors.push('Isolation must be "workspace" or "worktree"');
			}
			
			if (config.cliMode && config.cliMode !== 'supervised' && config.cliMode !== 'autonomous') {
				errors.push('CLI mode must be "supervised" or "autonomous"');
			}
		}
		
		return {
			valid: errors.length === 0,
			errors
		};
	}
}
