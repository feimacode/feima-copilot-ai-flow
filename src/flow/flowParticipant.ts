/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { FlowEngine } from './flowEngine';
import { FlowLibrary } from './flowLibrary';
import { FlowDiscoveryService } from './flowDiscoveryService';
import { ILogger } from '../platform/log/common/logService';
import { renderPrompt } from '@vscode/prompt-tsx';
import { FlowAuthoringSkill } from '../prompts/flowAuthoringSkill';

/**
 * Chat participant that orchestrates flow discussions.
 * Handles request routing and delegates to specialized services.
 */
export class FlowParticipant {
	private readonly engine: FlowEngine;
	private readonly library: FlowLibrary;
	private readonly discoveryService: FlowDiscoveryService;

	constructor(private readonly context: vscode.ExtensionContext, log: ILogger) {
		const engineLog = log.createSubLogger('FlowEngine');
		const discoveryLog = log.createSubLogger('Discovery');
		this.engine = new FlowEngine(engineLog);
		this.library = new FlowLibrary(context);
		this.discoveryService = new FlowDiscoveryService(discoveryLog);
	}
	
	/**
	 * Register the @flow participant
	 */
	register(): vscode.Disposable {
		const participant = vscode.chat.createChatParticipant(
			'feima.copilot-ai-flow',
			this.handleRequest.bind(this)
		);
		
		participant.iconPath = new vscode.ThemeIcon('git-branch');
		
		return participant;
	}
	
	/**
	 * Handle incoming chat requests
	 */
	private async handleRequest(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		
		try {
			// Dispatch slash commands (/search, /list, /browse, /install) before any
			// flow-execution logic. These commands query/install the built-in library.
			if (request.command) {
				return this.handleLibraryCommand(request, stream, token);
			}

			const flowFileUri = await this.discoveryService.findFlowFile(request, context, token);

			if (!flowFileUri) {
				stream.markdown('**Usage**: Reference a flow file or provide its name.\n\n');
				stream.markdown('- Attach a file: `@flow #file:./my-flow.flow.yaml What should we do?`\n\n');
				stream.markdown('- Use a name: `@flow sdd-spec-kit` (searches `.github/flows/`)\n\n');
				stream.markdown('Open the gallery: `AI Flow: Open Flow Gallery`');
				return {};
			}

			return this.engine.execute(flowFileUri, request, context, stream, token);
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			stream.markdown(`❌ **Error**: ${errorMessage}`);
			return { errorDetails: { message: errorMessage } };
		}
	}

	// ------------------------------------------------------------------
	// Library slash-command handlers
	// ------------------------------------------------------------------

	/**
	 * Routes `/search`, `/list`, `/browse`, and `/install` commands to their
	 * respective handlers. Only called when `request.command` is set.
	 */
	private async handleLibraryCommand(
		request: vscode.ChatRequest,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		switch (request.command) {
			case 'search':
				return this.handleSearch(request.prompt, stream, token);
			case 'list':
				return this.handleList(stream, token);
			case 'browse':
				return this.handleBrowse(stream, token);
			case 'install':
				return this.handleInstall(request.prompt, stream, token);
			case 'create':
				return this.handleCreate(request.prompt, stream, token);
			case 'enhance':
				return this.handleEnhance(request.prompt, stream, token);
			default:
				stream.markdown(`Unknown command \`/${request.command}\`. Available commands: \`/search\`, \`/list\`, \`/browse\`, \`/install\`, \`/create\`, \`/enhance\`.`);
				return {};
		}
	}

	/** `/search <query>` — filter built-in flows by name / tags / category. */
	private async handleSearch(
		query: string,
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const q = query.trim();
		if (!q) {
			stream.markdown('**Usage**: `@flow /search <query>`\n\nSearch for flows by name, tag, or category.\n\n**Examples**:\n- `@flow /search openspec`\n- `@flow /search refactoring`\n- `@flow /search sprint`');
			return {};
		}

		stream.progress('Searching flows...');
		const results = await this.library.search(q);

		if (results.length === 0) {
			stream.markdown(`No flows found matching **"${q}"**.\n\nTry \`@flow /list\` to see all available flows.`);
			return {};
		}

		stream.markdown(`## Search Results for "${q}" (${results.length})\n\n`);
		for (const f of results) {
			stream.markdown(`### ${f.name}\n`);
			if (f.description) {
				stream.markdown(`${f.description}\n\n`);
			}
			const meta: string[] = [];
			if (f.category) { meta.push(`**Category**: ${f.category}`); }
			if (f.difficulty) { meta.push(`**Difficulty**: ${f.difficulty}`); }
			if (f.tags?.length) { meta.push(`**Tags**: ${f.tags.join(', ')}`); }
			if (meta.length) {
				stream.markdown(meta.join(' · ') + '\n\n');
			}
			stream.markdown(`📥 Install: \`@flow /install ${f.id}\`\n\n---\n\n`);
		}
		return {};
	}

	/** `/list` — list all built-in flows grouped by category. */
	private async handleList(
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		stream.progress('Loading flow library...');
		const all = await this.library.getAll();

		if (all.length === 0) {
			stream.markdown('No built-in flows found.');
			return {};
		}

		// Group by category
		const grouped = new Map<string, typeof all>();
		for (const f of all) {
			const cat = f.category ?? 'Uncategorized';
			if (!grouped.has(cat)) { grouped.set(cat, []); }
			grouped.get(cat)!.push(f);
		}

		stream.markdown(`## Flow Library (${all.length} flows)\n\n`);
		for (const [category, flows] of grouped) {
			stream.markdown(`### ${category}\n\n`);
			for (const f of flows) {
				stream.markdown(`- **${f.name}** (\`${f.id}\`)`);
				if (f.description) {
					stream.markdown(` — ${f.description}`);
				}
				stream.markdown('\n');
			}
			stream.markdown('\n');
		}
		stream.markdown('---\n\n💡 Use `@flow /search <query>` to filter, or `@flow /install <id>` to copy a flow to your workspace.');
		return {};
	}

	/** `/browse` — gallery view with full metadata (sticky command). */
	private async handleBrowse(
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		stream.progress('Loading flow gallery...');
		const all = await this.library.getAll();

		if (all.length === 0) {
			stream.markdown('No built-in flows found.');
			return {};
		}

		const grouped = new Map<string, typeof all>();
		for (const f of all) {
			const cat = f.category ?? 'Uncategorized';
			if (!grouped.has(cat)) { grouped.set(cat, []); }
			grouped.get(cat)!.push(f);
		}

		stream.markdown(`# Flow Gallery\n\n${all.length} built-in flows available.\n\n`);
		for (const [category, flows] of grouped) {
			stream.markdown(`## ${category}\n\n`);
			for (const f of flows) {
				stream.markdown(`### ${f.name}\n`);
				if (f.description) {
					stream.markdown(`> ${f.description}\n\n`);
				}
				const badges: string[] = [];
				if (f.difficulty) { badges.push(`🎯 ${f.difficulty}`); }
				if (f.tags?.length) { badges.push(`🏷 ${f.tags.join(', ')}`); }
				if (f.version) { badges.push(`v${f.version}`); }
				if (f.author) { badges.push(`✍ ${f.author}`); }
				if (badges.length) {
					stream.markdown(badges.join(' · ') + '\n\n');
				}
				stream.markdown(`\`@flow /install ${f.id}\`\n\n`);
			}
		}
		return {};
	}

	/** `/install <id>` — copy a built-in flow to the workspace. */
	private async handleInstall(
		nameOrId: string,
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const target = nameOrId.trim();
		if (!target) {
			stream.markdown('**Usage**: `@flow /install <flow-id>`\n\nUse `@flow /list` to see available flow IDs.');
			return {};
		}

		stream.progress(`Looking up "${target}"...`);
		const entry = await this.library.find(target);
		if (!entry) {
			stream.markdown(`❌ Flow **"${target}"** not found.\n\nUse \`@flow /search ${target}\` to search, or \`@flow /list\` to see all flows.`);
			return {};
		}

		// Pick target folder: workspace root or .github/flows/
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			stream.markdown('❌ No workspace folder is open. Please open a folder first, then install the flow.');
			return {};
		}

		const targetFolder = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		try {
			await vscode.workspace.fs.createDirectory(targetFolder);
			const dest = await this.library.install(entry, targetFolder);
			const rel = vscode.workspace.asRelativePath(dest);
			stream.markdown(`✅ **${entry.name}** installed to \`${rel}\`\n\n`);
			stream.markdown(`Open the flow: \`@flow #file:./${rel}\`\n\n`);
			stream.button({ command: 'vscode.open', arguments: [dest], title: 'Open Flow File' });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('FileExistsError') || msg.includes('already exists')) {
				stream.markdown(`ℹ️ **${entry.name}** is already installed in \`.github/flows/\`. No changes made.`);
			} else {
				stream.markdown(`❌ Install failed: ${msg}`);
			}
		}
		return {};
	}

	/** `/create <description>` — generate a new .flow.yaml from natural language. */
	private async handleCreate(
		prompt: string,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const description = prompt.trim();
		if (!description) {
			stream.markdown('**Usage**: `@flow /create <description>`\n\nDescribe the flow you want in natural language.\n\n**Example**: `@flow /create a code review with separate security and style lenses`');
			return {};
		}

		stream.progress('Generating flow...');

		try {
			const yamlContent = await this._generateFlowYaml(description, token);

			if (!yamlContent) {
				stream.markdown('❌ Failed to generate a valid flow. Try a more specific description.');
				return {};
			}

			const fileName = await this._writeFlowToWorkspace(yamlContent, stream);
			if (fileName) {
				stream.markdown(`✅ Flow created: \`${fileName}\`\n\n`);
				stream.markdown(`Run it with: \`@flow #file:${fileName}\`\n\n`);
				stream.markdown('💡 **Next steps**:\n- Run the flow to see it in action\n- Edit the YAML to customize roles and prompts\n- Use `@flow /enhance` to add tools, stages, or integrations');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			stream.markdown(`❌ **Error**: ${msg}`);
		}

		return {};
	}

	/** `/enhance <instruction>` — enhance an existing flow from a natural language instruction. */
	private async handleEnhance(
		input: string,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const trimmed = input.trim();
		if (!trimmed) {
			stream.markdown('**Usage**: `@flow /enhance <instruction>`\n\nAdd features to the active flow.\n\n**Example**: `@flow /enhance --add-jira-integration`');
			return {};
		}

		stream.progress('Enhancing flow...');

		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				stream.markdown('❌ No workspace folder is open.');
				return {};
			}

			const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
			let flowFiles: [string, vscode.Uri][] = [];
			try {
				const entries = await vscode.workspace.fs.readDirectory(flowsDir);
				flowFiles = entries
					.filter(([name]) => name.endsWith('.flow.yaml'))
					.map(([name]) => [name, vscode.Uri.joinPath(flowsDir, name)] as [string, vscode.Uri]);
			} catch {
				stream.markdown('❌ No flows found in `.github/flows/`. Use `@flow /install` or `@flow /create` first.');
				return {};
			}

			// If no explicit file specified, use the first .flow.yaml found
			let targetUri: vscode.Uri;
			let targetName: string;
			const words = trimmed.split(/\s+/);
			const firstWord = words[0];

			if (firstWord.endsWith('.flow.yaml') || firstWord.endsWith('.flow.yml')) {
				targetName = firstWord;
				const match = flowFiles.find(([name]) => name === firstWord);
				if (match) {
					targetUri = match[1];
				} else {
					targetUri = vscode.Uri.joinPath(flowsDir, firstWord);
				}
			} else if (flowFiles.length === 1) {
				targetName = flowFiles[0][0];
				targetUri = flowFiles[0][1];
			} else {
				stream.markdown(`❌ Multiple flows found. Specify which flow to enhance:\n\n`);
				for (const [name] of flowFiles) {
					stream.markdown(`- \`@flow /enhance ${name} ${trimmed}\`\n`);
				}
				return {};
			}

			// Read existing flow
			let existingContent: string;
			try {
				const bytes = await vscode.workspace.fs.readFile(targetUri);
				existingContent = Buffer.from(bytes).toString('utf8');
			} catch {
				stream.markdown(`❌ Flow file \`${targetName}\` not found.`);
				return {};
			}

			const enhancedYaml = await this._enhanceFlowYaml(existingContent, trimmed, token);
			if (!enhancedYaml) {
				stream.markdown('❌ Failed to enhance the flow. Check the instruction and try again.');
				return {};
			}

			await vscode.workspace.fs.writeFile(targetUri, Buffer.from(enhancedYaml, 'utf8'));
			stream.markdown(`✅ Enhanced \`${targetName}\`\n\n`);
			stream.markdown(`Run it with: \`@flow #file:${targetName}\``);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			stream.markdown(`❌ **Error**: ${msg}`);
		}

		return {};
	}

	/** Generate YAML from natural language description using Prompt-TSX. */
	private async _generateFlowYaml(
		description: string,
		token: vscode.CancellationToken
	): Promise<string | undefined> {
		const { messages } = await renderPrompt(
			FlowAuthoringSkill,
			{ description },
			{ modelMaxPromptTokens: 8192 },
			undefined as unknown as vscode.LanguageModelChat
		);

		const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
		if (models.length === 0) { return undefined; }

		const response = await models[0].sendRequest(messages, {}, token);
		let text = '';
		for await (const chunk of response.stream) {
			if (chunk instanceof vscode.LanguageModelTextPart) {
				text += chunk.value;
			}
		}

		const yamlContent = this._extractYamlBlock(text);
		return this._validateFlowYaml(yamlContent);
	}

	/** Enhance an existing flow using Prompt-TSX. */
	private async _enhanceFlowYaml(
		existingContent: string,
		instruction: string,
		token: vscode.CancellationToken
	): Promise<string | undefined> {
		const description = `Enhance this existing flow YAML:\n\n\`\`\`yaml\n${existingContent}\n\`\`\`\n\nInstruction: ${instruction}`;
		const { messages } = await renderPrompt(
			FlowAuthoringSkill,
			{ description },
			{ modelMaxPromptTokens: 8192 },
			undefined as unknown as vscode.LanguageModelChat
		);

		const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
		if (models.length === 0) { return undefined; }

		const response = await models[0].sendRequest(messages, {}, token);
		let text = '';
		for await (const chunk of response.stream) {
			if (chunk instanceof vscode.LanguageModelTextPart) {
				text += chunk.value;
			}
		}

		const yamlContent = this._extractYamlBlock(text);
		return this._validateFlowYaml(yamlContent);
	}

	/** Extract YAML from model output (handles markdown fences and raw YAML). */
	private _extractYamlBlock(text: string): string {
		// Try markdown code fence first
		const fenceMatch = text.match(/```ya?ml?\s*\n([\s\S]*?)```/);
		if (fenceMatch) {
			return fenceMatch[1].trim();
		}
		// Try without language identifier
		const fenceMatch2 = text.match(/```\s*\n([\s\S]*?)```/);
		if (fenceMatch2) {
			return fenceMatch2[1].trim();
		}
		// Raw YAML — strip any leading/trailing commentary
		const lines = text.trim().split('\n');
		const startIdx = lines.findIndex(l => l.trim().startsWith('name:'));
		if (startIdx >= 0) {
			return lines.slice(startIdx).join('\n').trim();
		}
		return text.trim();
	}

	/** Validate YAML against flow schema. Returns valid YAML or undefined. */
	private _validateFlowYaml(content: string): string | undefined {
		try {
			const parsed = yaml.load(content);
			if (!parsed || typeof parsed !== 'object') {
				return undefined;
			}
			const obj = parsed as Record<string, unknown>;
			if (!obj.name || typeof obj.name !== 'string') {
				return undefined;
			}
			if (!obj.roles && !obj.stages && !obj.groups) {
				return undefined;
			}
			return content;
		} catch {
			return undefined;
		}
	}

	/** Write flow YAML to .github/flows/ in the workspace and return relative path. */
	private async _writeFlowToWorkspace(
		content: string,
		stream: vscode.ChatResponseStream
	): Promise<string | undefined> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			stream.markdown('❌ No workspace folder is open. Please open a folder first.');
			return undefined;
		}

		const flowsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'flows');
		await vscode.workspace.fs.createDirectory(flowsDir);

		// Derive filename from the flow name
		let fileName: string;
		try {
			const parsed = yaml.load(content) as Record<string, unknown> | undefined;
			const name = parsed?.name ? String(parsed.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'generated-flow';
			fileName = `${name}.flow.yaml`;
		} catch {
			fileName = 'generated-flow.flow.yaml';
		}

		const targetUri = vscode.Uri.joinPath(flowsDir, fileName);
		await vscode.workspace.fs.writeFile(targetUri, Buffer.from(content, 'utf8'));

		return `.github/flows/${fileName}`;
	}
}