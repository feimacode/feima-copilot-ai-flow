/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { FlowEngine } from './flowEngine';
import { FlowLibrary } from './flowLibrary';
import { FlowDiscoveryService } from './flowDiscoveryService';
import { CatalogClient } from './catalogClient';
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

	/** Ordered tutorial pages — markdown files inside docs-site/src/content/docs/tutorials/. */
	private static readonly _tutorialPages = [
		{ file: 'hello-world.md', title: 'Hello, Flow' },
		{ file: 'your-first-flow.md', title: 'Your First Flow' },
		{ file: 'pipeline-basics.md', title: 'Pipeline Basics' },
		{ file: 'customize-flow.md', title: 'Make It Yours' },
		{ file: 'tool-control.md', title: 'Tool Control' },
		{ file: 'staged-iteration.md', title: 'Add Iteration' },
		{ file: 'iteration-convergence.md', title: 'Iteration & Convergence' },
		{ file: 'fork-join.md', title: 'Fork-Join' },
		{ file: 'context-files.md', title: 'Context Files' },
		{ file: 'efficiency-patterns.md', title: 'Efficiency Patterns' },
		{ file: 'quality-gates.md', title: 'Quality Gates' },
		{ file: 'human-gate.md', title: 'Human Gate' },
		{ file: 'dialog-simulator.md', title: 'Dialog Simulator' },
		{ file: 'cli-delegation.md', title: 'Go Autonomous' },
		{ file: 'autonomous-design.md', title: 'Autonomous Design' },
		{ file: 'jira-integration.md', title: 'Connect to Jira' },
		{ file: 'case-study-full-cycle.md', title: 'Case Study: Full-Cycle Flow Design' },
	];

	constructor(private readonly context: vscode.ExtensionContext, log: ILogger) {
		const engineLog = log.createSubLogger('FlowEngine');
		const discoveryLog = log.createSubLogger('Discovery');
		const catalogClient = new CatalogClient(context, log);
		this.engine = new FlowEngine(engineLog);
		this.library = new FlowLibrary(context, catalogClient);
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

	/** Expose the FlowLibrary for URI handler access. */
	getLibrary(): FlowLibrary {
		return this.library;
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
			case 'refresh':
				return this.handleRefresh(stream, token);
			case 'status':
				return this.handleStatus(stream, token);
			case 'tutorial':
				return this.handleTutorial(request.prompt, stream);
			case 'gallery':
				return this.handleGallery(stream);
			default:
				stream.markdown(`Unknown command \`/${request.command}\`. Available commands: \`/search\`, \`/list\`, \`/browse\`, \`/install\`, \`/create\`, \`/enhance\`, \`/refresh\`, \`/status\`, \`/tutorial\`, \`/gallery\`.`);
				return {};
		}
	}

	/** `/search <query>` — filter flows by name / tags / category across all sources. */
	private async handleSearch(
		query: string,
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const q = query.trim();
		if (!q) {
			stream.markdown('**Usage**: `@flow /search <query> [--source builtin|catalog|workspace]`\n\nSearch for flows by name, tag, or category.\n\n**Examples**:\n- `@flow /search openspec`\n- `@flow /search refactoring --source catalog`\n- `@flow /search sprint`');
			return {};
		}

		// Parse --source flag
		let sourceFilter: string | undefined;
		const sourceMatch = q.match(/--source\s+(\w+)/i);
		let searchQuery = q;
		if (sourceMatch) {
			sourceFilter = sourceMatch[1].toLowerCase();
			searchQuery = q.replace(sourceMatch[0], '').trim();
		}

		if (!searchQuery) {
			stream.markdown('**Usage**: `@flow /search <query>`\n\nPlease provide a search term.');
			return {};
		}

		stream.progress('Searching flows...');
		let results = await this.library.search(searchQuery);

		// Apply source filter
		if (sourceFilter && ['builtin', 'catalog', 'workspace'].includes(sourceFilter)) {
			results = results.filter(f => f.source === sourceFilter);
		}

		if (results.length === 0) {
			const sourceHint = sourceFilter ? ` in "${sourceFilter}" source` : '';
			stream.markdown(`No flows found matching **"${searchQuery}"**${sourceHint}.\n\nTry \`@flow /list\` to see all available flows.`);
			return {};
		}

		stream.markdown(`## Search Results for "${searchQuery}" (${results.length})\n\n`);
		for (const f of results) {
			const sourceLabel = f.source === 'catalog' ? '[catalog]' : f.source === 'workspace' ? '[workspace]' : '[builtin]';
			stream.markdown(`### ${f.name} ${sourceLabel}\n`);
			if (f.description) {
				stream.markdown(`${f.description}\n\n`);
			}
			const meta: string[] = [];
			if (f.provider) { meta.push(`**Provider**: ${f.provider}`); }
			if (f.trust) { meta.push(`**Trust**: ${f.trust}`); }
			if (f.category) { meta.push(`**Category**: ${f.category}`); }
			if (f.difficulty) { meta.push(`**Difficulty**: ${f.difficulty}`); }
			if (f.orchestration) { meta.push(`**Pattern**: ${f.orchestration}`); }
			if (f.roleCount !== undefined) { meta.push(`**Roles**: ${f.roleCount}`); }
			if (f.tags?.length) { meta.push(`**Tags**: ${f.tags.join(', ')}`); }
			if (meta.length) {
				stream.markdown(meta.join(' · ') + '\n\n');
			}
			// Clickable action buttons
			if (f.filePath) {
				const fileUri = vscode.Uri.file(f.filePath);
				stream.button({ command: 'vscode.openWith', arguments: [fileUri, 'feima.copilot-ai-flow.flowEditor'], title: `📂 Open ${f.name}` });
			} else if (f.source === 'catalog') {
				stream.button({ command: 'feima.copilot-ai-flow.openGalleryFlow', arguments: [f.id], title: `📂 Open ${f.name}` });
			}
			stream.button({ command: 'feima.copilot-ai-flow.installAndRun', arguments: [f.id], title: `▶ Run ${f.name}` });
			// Divider between flows
			stream.markdown(`\n\n---\n\n`);
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
				const srcBadge = f.source === 'catalog' ? '📦' : f.source === 'workspace' ? '📁' : '🏠';
				stream.markdown(`- ${srcBadge} **${f.name}** (\`${f.id}\`)`);
				if (f.description) {
					stream.markdown(` — ${f.description}`);
				}
				// Inline clickable actions on the same line before the divider
				stream.markdown(' ');
				if (f.filePath) {
					const fileUri = vscode.Uri.file(f.filePath);
					stream.button({ command: 'vscode.openWith', arguments: [fileUri, 'feima.copilot-ai-flow.flowEditor'], title: `📂 Open` });
				} else if (f.source === 'catalog') {
					stream.button({ command: 'feima.copilot-ai-flow.installAndOpen', arguments: [f.id], title: `📂 Open` });
				}
				// Divider between flows
				stream.markdown('\n\n---\n\n');
			}
		}
		stream.markdown('💡 Use `@flow /search <query>` to filter, or `@flow /install <id>` to copy a flow to your workspace.\n\n💡 Use `@flow /gallery` to open the visual gallery.');
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
			stream.markdown('No flows found.');
			return {};
		}

		const grouped = new Map<string, typeof all>();
		for (const f of all) {
			const cat = f.category ?? 'Uncategorized';
			if (!grouped.has(cat)) { grouped.set(cat, []); }
			grouped.get(cat)!.push(f);
		}

		stream.markdown(`# Flow Gallery\n\n${all.length} flows available.\n\n`);
		stream.button({ command: 'feima.copilot-ai-flow.browse', title: '🖼 Open Visual Gallery' });
		stream.markdown('\n\n---\n\n');
		for (const [category, flows] of grouped) {
			stream.markdown(`## ${category}\n\n`);
			for (const f of flows) {
				stream.markdown(`### ${f.name}\n`);
				if (f.description) {
					stream.markdown(`> ${f.description}\n\n`);
				}
				const badges: string[] = [];
				// Source badge
				if (f.source === 'catalog') {
					badges.push(`📦 catalog`);
				} else if (f.source === 'workspace') {
					badges.push(`📁 workspace`);
				} else {
					badges.push(`🏠 builtin`);
				}
				// Trust badge (catalog only)
				if (f.trust === 'official') {
					badges.push(`✅ official`);
				} else if (f.trust === 'community') {
					badges.push(`👥 community`);
				}
				// Provider (catalog only)
				if (f.provider) {
					badges.push(`📋 ${f.provider}`);
				}
				// Orchestration pattern
				if (f.orchestration) {
					badges.push(`🔄 ${f.orchestration}`);
				}
				// Role count
				if (f.roleCount !== undefined) {
					badges.push(`👤 ${f.roleCount} roles`);
				}
				if (f.difficulty) { badges.push(`🎯 ${f.difficulty}`); }
				if (f.tags?.length) { badges.push(`🏷 ${f.tags.join(', ')}`); }
				if (f.version) { badges.push(`v${f.version}`); }
				if (f.author) { badges.push(`✍ ${f.author}`); }
				if (badges.length) {
					stream.markdown(badges.join(' · ') + '\n\n');
				}
				// Clickable action buttons on the same line
				if (f.filePath) {
					const fileUri = vscode.Uri.file(f.filePath);
					stream.button({ command: 'vscode.openWith', arguments: [fileUri, 'feima.copilot-ai-flow.flowEditor'], title: `📂 Open in Editor` });
				} else if (f.source === 'catalog') {
					stream.button({ command: 'feima.copilot-ai-flow.installAndOpen', arguments: [f.id], title: `📂 Open in Editor` });
				}
				// Divider between flows
				stream.markdown('\n\n---\n\n');
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
			const { dest, companions } = await this.library.install(entry, targetFolder);
			const rel = vscode.workspace.asRelativePath(dest);
			stream.markdown(`✅ **${entry.name}** installed to \`${rel}\`\n\n`);
			stream.markdown(`Open the flow: \`@flow #file:./${rel}\`\n\n`);
			stream.button({ command: 'vscode.open', arguments: [dest], title: 'Open Flow File' });

			// Report companions
			if (companions) {
				if (companions.skills.length > 0) {
					stream.markdown(`\n📦 This flow uses skills: ${companions.skills.map(s => `\`${s}\``).join(', ')}`);
				}
				if (companions.prompts.length > 0) {
					stream.markdown(`\n📦 This flow uses prompts/agents: ${companions.prompts.map(p => `\`${p}\``).join(', ')}`);
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('already exists') || msg.includes('Installation cancelled')) {
				stream.markdown(`ℹ️ **${entry.name}** is already installed in \`.github/flows/\`. No changes made.`);
			} else {
				stream.markdown(`❌ Install failed: ${msg}`);
			}
		}
		return {};
	}

	/** `/tutorial [page]` — browse the extension's built-in tutorial pages. */
	private async handleTutorial(
		prompt: string,
		stream: vscode.ChatResponseStream
	): Promise<vscode.ChatResult> {
		const arg = prompt.trim();
		let pageIndex = 0;

		if (arg) {
			const parsed = parseInt(arg, 10);
			if (!isNaN(parsed) && parsed >= 1 && parsed <= FlowParticipant._tutorialPages.length) {
				pageIndex = parsed - 1;
			} else {
				// Fuzzy match by title
				const lower = arg.toLowerCase();
				const found = FlowParticipant._tutorialPages.findIndex(
					p => p.title.toLowerCase().includes(lower) || p.file.toLowerCase().includes(lower)
				);
				if (found >= 0) {
					pageIndex = found;
				}
			}
		}

		const page = FlowParticipant._tutorialPages[pageIndex];
		const content = await this._readTutorialPage(page.file);

		const totalPages = FlowParticipant._tutorialPages.length;
		const progressPct = Math.round(((pageIndex + 1) / totalPages) * 100);

		stream.markdown(`# 📖 Tutorial — ${page.title}\n\n`);
		stream.markdown(`${content}\n\n`);
		stream.markdown(`---\n\n`);
		stream.markdown(`📄 **Page ${pageIndex + 1} of ${totalPages}** (${progressPct}%)\n\n`);

		// Navigation buttons
		if (pageIndex > 0) {
			const prev = FlowParticipant._tutorialPages[pageIndex - 1];
			stream.button({ command: 'feima.copilot-ai-flow.tutorialPage', arguments: [pageIndex - 1], title: `⬅ ${prev.title}` });
		}
		if (pageIndex < totalPages - 1) {
			const next = FlowParticipant._tutorialPages[pageIndex + 1];
			stream.button({ command: 'feima.copilot-ai-flow.tutorialPage', arguments: [pageIndex + 1], title: `${next.title} ➡` });
		}

		return {};
	}

	/** `/gallery` — open the Flow Gallery UI panel automatically. */
	private async handleGallery(
		stream: vscode.ChatResponseStream
	): Promise<vscode.ChatResult> {
		// Auto-open the gallery panel immediately
		await vscode.commands.executeCommand('feima.copilot-ai-flow.browse');

		stream.markdown('🖼 Flow Gallery opened in the editor area.\n\n');
		stream.markdown('Use the gallery to browse, preview, and install flows with one click.');
		return {};
	}

	/** Read a tutorial page from the docs-site tutorials directory, stripping YAML frontmatter and HTML. */
	private async _readTutorialPage(filename: string): Promise<string> {
		const docUri = vscode.Uri.joinPath(this.context.extensionUri, 'docs-site', 'src', 'content', 'docs', 'tutorials', filename);
		try {
			const bytes = await vscode.workspace.fs.readFile(docUri);
			let raw = Buffer.from(bytes).toString('utf8');
			// Strip YAML frontmatter (--- … ---) if present
			if (raw.startsWith('---')) {
				const endIdx = raw.indexOf('---', 3);
				if (endIdx !== -1) {
					raw = raw.substring(endIdx + 3).trimStart();
				}
			}
			// Sanitize HTML — the chat panel renders Markdown but not raw HTML.
			// 1) Remove <img> tags and their enclosing <a> wrappers (screenshots)
			raw = raw.replace(/<a\s[^>]*><img[\s\S]*?<\/a>\n?/gi, '');
			// 2) Convert actionable <a> links to Markdown: [text](url)
			raw = raw.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
			// 3) <br> → newline
			raw = raw.replace(/<br\s*\/?>/gi, '\n');
			// 4) <small>, <kbd>, <sup>, <sub>, <mark>, <ins>, <del>, <abbr> → strip tags, keep inner text
			raw = raw.replace(/<\/?(?:small|kbd|sup|sub|mark|ins|del|abbr)[^>]*>/gi, '');
			return raw;
		} catch {
			return `_Unable to load tutorial page: ${filename}_`;
		}
	}

	/** `/refresh` — force refresh the catalog from GitHub. */
	private async handleRefresh(
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		stream.progress('Refreshing catalog from GitHub...');
		try {
			const flows = await this.library.refresh(true);
			const catalogFlows = flows.filter(f => f.source === 'catalog');
			stream.markdown(`✅ Catalog refreshed successfully.\n\n`);
			stream.markdown(`- **${catalogFlows.length}** catalog flows available\n`);
			stream.markdown(`- **${flows.length}** total flows (builtin + catalog + workspace)\n\n`);
			stream.markdown(`Use \`@flow /browse\` to see all flows.`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			stream.markdown(`❌ Refresh failed: ${msg}\n\n`);
			stream.markdown(`The extension will continue using cached or bundled catalog data.`);
		}
		return {};
	}

	/** `/status` — show catalog health and metadata. */
	private async handleStatus(
		stream: vscode.ChatResponseStream,
		_token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		stream.progress('Checking catalog status...');
		const all = await this.library.getAll();

		const builtin = all.filter(f => f.source === 'builtin');
		const catalog = all.filter(f => f.source === 'catalog');
		const workspace = all.filter(f => f.source === 'workspace');

		const official = catalog.filter(f => f.trust === 'official');
		const community = catalog.filter(f => f.trust === 'community');

		const providers = new Set(catalog.map(f => f.provider).filter(Boolean));

		stream.markdown(`# 📊 Flow Catalog Status\n\n`);
		stream.markdown(`| Source | Count |\n`);
		stream.markdown(`|--------|-------|\n`);
		stream.markdown(`| 🏠 Builtin | ${builtin.length} |\n`);
		stream.markdown(`| 📦 Catalog | ${catalog.length} |\n`);
		stream.markdown(`| 📁 Workspace | ${workspace.length} |\n`);
		stream.markdown(`| **Total** | **${all.length}** |\n\n`);

		if (catalog.length > 0) {
			stream.markdown(`### Catalog Details\n\n`);
			stream.markdown(`- ✅ Official: ${official.length}\n`);
			stream.markdown(`- 👥 Community: ${community.length}\n`);
			stream.markdown(`- 📋 Providers: ${[...providers].join(', ') || 'none'}\n\n`);

			const byOrchestration = new Map<string, number>();
			for (const f of catalog) {
				if (f.orchestration) {
					byOrchestration.set(f.orchestration, (byOrchestration.get(f.orchestration) || 0) + 1);
				}
			}
			if (byOrchestration.size > 0) {
				stream.markdown(`### Orchestration Patterns\n\n`);
				for (const [pattern, count] of byOrchestration) {
					stream.markdown(`- 🔄 ${pattern}: ${count}\n`);
				}
				stream.markdown('\n');
			}
		}

		stream.markdown(`---\n\n`);
		stream.markdown(`💡 Use \`@flow /refresh\` to fetch the latest catalog from GitHub.\n`);
		stream.markdown(`💡 Use \`@flow /browse\` to explore all available flows.`);
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