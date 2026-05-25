/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FlowEngine } from './flowEngine';
import { FlowLibrary } from './flowLibrary';
import { FlowDiscoveryService } from './flowDiscoveryService';

/**
 * Chat participant that orchestrates flow discussions.
 * Handles request routing and delegates to specialized services.
 */
export class FlowParticipant {
	private readonly engine: FlowEngine;
	private readonly library: FlowLibrary;
	private readonly discoveryService: FlowDiscoveryService;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.engine = new FlowEngine();
		this.library = new FlowLibrary(context);
		this.discoveryService = new FlowDiscoveryService();
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
			default:
				stream.markdown(`Unknown command \`/${request.command}\`. Available commands: \`/search\`, \`/list\`, \`/browse\`, \`/install\`.`);
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
}