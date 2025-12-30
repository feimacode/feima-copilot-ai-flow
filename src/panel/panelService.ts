/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

/**
 * Definition of a single role in a panel discussion
 */
export interface IRoleDefinition {
	/** Display name of the role (e.g., "Developer", "QA Engineer") */
	readonly name: string;
	
	/** System prompt defining the role's perspective and responsibilities */
	readonly systemPrompt: string;
	
	/** LLM model to use for this role (optional, uses default if not specified) */
	readonly model?: string;
}

/**
 * Orchestration strategy for panel discussions
 */
export type OrchestrationStrategy = 'sequential' | 'all-respond' | 'round-robin';

/**
 * Metadata about a prompt
 */
export interface IPromptMetadata {
	readonly name: string;
	readonly description?: string;
	readonly category?: string;
	readonly subcategory?: string;
	readonly tags?: string[];
	readonly difficulty?: 'beginner' | 'intermediate' | 'advanced';
	readonly rolesCount?: number;
	readonly version?: string;
	readonly author?: string;
}

/**
 * Configuration for a panel discussion from prompt.md
 */
export interface IPanelConfig extends IPromptMetadata {
	/** List of roles participating in the discussion */
	readonly roles: ReadonlyArray<IRoleDefinition>;
	
	/** How roles should interact */
	readonly orchestration: OrchestrationStrategy;
	
	/** Maximum number of discussion rounds (for round-robin) */
	readonly maxRounds: number;
	
	/** Shared context/body content from prompt.md */
	readonly sharedContext: string;
	
	/** Original prompt file URI */
	readonly promptUri: vscode.Uri;
	
	/** Global tools available to all roles (optional) */
	readonly tools?: string[];
	
	/** Use GitHub Copilot CLI instead of language model API (optional) */
	readonly useCli?: boolean;
}

/**
 * Result from a single role's response
 */
export interface IRoleResponse {
	readonly roleName: string;
	readonly content: string;
	readonly model: string;
	readonly error?: string;
}

/**
 * Service for parsing and managing panel discussions
 */
export class PanelService {
	
	/**
	 * Parse a prompt.md file to extract panel configuration
	 */
	async parsePrompt(uri: vscode.Uri): Promise<IPanelConfig | undefined> {
		try {
			// Read the file content
			const content = await vscode.workspace.fs.readFile(uri);
			const textContent = Buffer.from(content).toString('utf8');
			
			// Split into header and body
			const parts = textContent.split(/^---\s*$/m);
			if (parts.length < 3) {
				// Better error message with debugging info
				throw new Error(
					`Prompt file must have a YAML header (---...---). ` +
					`Found ${parts.length} parts. File length: ${textContent.length} chars. ` +
					`First 100 chars: ${textContent.substring(0, 100)}`
				);
			}
			
			// Parse YAML header
			const headerText = parts[1];
			const header = yaml.load(headerText) as Record<string, unknown>;
			
			// Extract body (everything after second ---)
			const body = parts.slice(2).join('---').trim();
			
			// Parse roles
			const roles = this.parseRoles(header.roles);
			if (roles.length < 2) {
				throw new Error('Panel discussion requires at least 2 roles');
			}
			
			// Extract configuration
			const orchestration = this.parseOrchestration(header.orchestration);
			const maxRounds = this.parseMaxRounds(header.maxRounds);
			const tools = this.parseTools(header.tools);
			const useCli = this.parseUseCli(header.useCli);
			
			return {
				name: String(header.name || 'Untitled'),
				description: header.description ? String(header.description) : undefined,
				category: header.category ? String(header.category) : undefined,
				subcategory: header.subcategory ? String(header.subcategory) : undefined,
				tags: Array.isArray(header.tags) ? header.tags.map(String) : undefined,
				difficulty: this.parseDifficulty(header.difficulty),
				rolesCount: roles.length,
				version: header.version ? String(header.version) : undefined,
				author: header.author ? String(header.author) : undefined,
				roles,
				orchestration,
				maxRounds,
				sharedContext: body,
				promptUri: uri,
				tools,
				useCli
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
			const systemPrompt = role.systemPrompt ? String(role.systemPrompt) : undefined;
			const model = role.model ? String(role.model) : undefined;
			
			if (name && systemPrompt) {
				roles.push({
					name,
					systemPrompt,
					model
				});
			}
		}
		
		return roles;
	}
	
	/**
	 * Parse orchestration strategy
	 */
	private parseOrchestration(value: unknown): OrchestrationStrategy {
		if (typeof value === 'string') {
			if (value === 'sequential' || value === 'all-respond' || value === 'round-robin') {
				return value;
			}
		}
		return 'sequential'; // default
	}
	
	/**
	 * Parse max rounds
	 */
	private parseMaxRounds(value: unknown): number {
		if (typeof value === 'number') {
			return Math.max(1, Math.min(10, value)); // Clamp between 1-10
		}
		return 1; // default
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
	 * Parse useCli boolean from YAML
	 */
	private parseUseCli(value: unknown): boolean | undefined {
		if (typeof value === 'boolean') {
			return value;
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
	 * Validate a panel configuration
	 */
	validate(config: IPanelConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		
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
			
			if (!role.systemPrompt.trim()) {
				errors.push(`Role "${role.name}" must have a system prompt`);
			}
		}
		
		if (config.maxRounds < 1 || config.maxRounds > 10) {
			errors.push('Max rounds must be between 1 and 10');
		}
		
		return {
			valid: errors.length === 0,
			errors
		};
	}
}
