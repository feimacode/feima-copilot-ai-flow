/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { FlowEngine } from './flowEngine';
import { FlowLibrary } from './flowLibrary';
import { FlowDiscoveryService } from './flowDiscoveryService';
import { FlowMatcher } from './flowMatcher';
import { CatalogClient } from './catalogClient';
import { ILogger } from '../platform/log/common/logService';
import { renderPrompt } from '@vscode/prompt-tsx';
import { FlowAuthoringSkill } from '../prompts/flowAuthoringSkill';
import { selectModel } from '../util/selectModel';
import { refToUri } from '../util/refToUri';
import { getMaxGenerationRetries } from '../config/flowSettings';

/**
 * Chat participant that orchestrates flow discussions.
 * Handles request routing and delegates to specialized services.
 */
export class FlowParticipant {
	private readonly engine: FlowEngine;
	private readonly library: FlowLibrary;
	private readonly discoveryService: FlowDiscoveryService;
	private readonly matcher: FlowMatcher;
	private readonly log: ILogger;

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
		const participantLog = log.createSubLogger('Participant');
		const catalogClient = new CatalogClient(context, log);
		this.engine = new FlowEngine(engineLog);
		this.library = new FlowLibrary(context, catalogClient);
		this.discoveryService = new FlowDiscoveryService(discoveryLog);
		this.matcher = new FlowMatcher(this.library, log.createSubLogger('Matcher'));
		this.log = participantLog;
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
			// Debug: log what we're receiving
			this.log.info(`Request received — command: ${request.command}, prompt: ${request.prompt}, references: ${request.references?.length}`);

			// Dispatch slash commands (/search, /list, /browse, /install) before any
			// flow-execution logic. These commands query/install the built-in library.
			if (request.command) {
				this.log.info(`Routing to handleLibraryCommand: ${request.command}`);
				return this.handleLibraryCommand(request, stream, token);
			}

			const flowFileUri = await this.discoveryService.findFlowFile(request, context, token);

			if (!flowFileUri) {
				// No explicit flow reference — try intent-based semantic matching
				const intentUri = await this._matchByIntent(request, stream, token);
				if (intentUri) {
					// Confident match found or user confirmed — execute directly
					return this.engine.execute(intentUri, request, context, stream, token);
				}

				// If intent matching showed matches but user didn't pick one, the
				// method handles its own UI. Only show usage if nothing matched at all.
				const all = await this.library.getAll();
				if (!all.some(f => f.source === 'workspace')) {
					stream.markdown('**Usage**: Reference a flow file or provide its name.\n\n');
					stream.markdown('- Attach a file: `@flow #file:./my-flow.flow.yaml What should we do?`\n\n');
					stream.markdown('- Use a name: `@flow sdd-spec-kit` (searches `.github/flows/`)\n\n');
					stream.markdown('Open the gallery: `AI Flow: Open Flow Gallery`');
				}
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
	// Intent-based matching fallback
	// ------------------------------------------------------------------

	/**
	 * Try to match a freeform user prompt to a workspace flow via LLM.
	 *
	 * - If the model is confident (top score ≥ 0.8), return the flow URI immediately.
	 * - If there are candidates but none is confident, show them as clickable buttons
	 *   in the chat stream and return undefined (the user can click to run).
	 * - If nothing matches at all, return undefined silently.
	 */
	private async _matchByIntent(
		request: vscode.ChatRequest,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.Uri | undefined> {
		const all = await this.library.getAll();
		const workspaceFlows = all.filter(f => f.source === 'workspace');

		if (workspaceFlows.length === 0) {
			this.log.trace('_matchByIntent: no workspace flows installed');
			return undefined;
		}

		const prompt = request.prompt.trim();
		if (!prompt) {
			return undefined;
		}

		this.log.info(`_matchByIntent: trying to match "${prompt.substring(0, 80)}" against ${workspaceFlows.length} workspace flows`);

		stream.progress('Finding the best flow for your request...');

		const outcome = await this.matcher.matchByIntent(prompt, request.model, token);

		if (token.isCancellationRequested) {
			return undefined;
		}

		if (outcome.matches.length === 0) {
			this.log.info('_matchByIntent: no matches found');
			return undefined;
		}

		// Confident — auto-execute the top match
		if (outcome.confident) {
			const top = outcome.matches[0];
			this.log.info(`_matchByIntent: confident match — ${top.entry.id} (score=${top.score})`);
			stream.markdown(`🔍 Matched **${top.entry.name}** (${Math.round(top.score * 100)}% confidence)\n\n`);
			if (top.reasoning) {
				stream.markdown(`> ${top.reasoning}\n\n`);
			}
			stream.markdown('---\n\n');

			if (top.entry.filePath) {
				return vscode.Uri.file(top.entry.filePath);
			}
		}

		// Not confident — show ranked candidates as buttons
		this.log.info(`_matchByIntent: ${outcome.matches.length} candidates, none confident — showing picker`);
		stream.markdown(`I'm not sure which flow fits your request best. Here are some options:\n\n`);

		for (const m of outcome.matches) {
			const pct = Math.round(m.score * 100);
			stream.markdown(`### ${m.entry.name} (${pct}% match)\n`);
			if (m.reasoning) {
				stream.markdown(`> ${m.reasoning}\n\n`);
			}
			if (m.entry.description) {
				stream.markdown(`${m.entry.description}\n\n`);
			}
			// Clickable button to run this flow with the user's original prompt
			const runArgs = [m.entry.id, prompt];
			stream.button({
				command: 'feima.copilot-ai-flow.runMatchedFlow',
				arguments: runArgs,
				title: `▶ Run ${m.entry.name}`
			});
			stream.markdown('\n\n---\n\n');
		}

		stream.markdown(`💡 Not what you're looking for? `);
		stream.markdown(`Use \`@flow /list\` to see all flows or attach a specific flow file with \`#file:\`.\n\n`);

		return undefined;
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
				return this.handleCreate(request, stream, token);
			case 'enhance':
				return this.handleEnhance(request, stream, token);
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
		request: vscode.ChatRequest,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const description = request.prompt.trim();
		this.log.info(`handleCreate: description="${description.substring(0, 80)}" model=${request.model?.name}(${request.model?.id}) vendor=${request.model?.vendor}`);

		if (!description) {
			this.log.info('handleCreate: empty description, returning usage');
			stream.markdown('**Usage**: `@flow /create <description>`\n\nDescribe the flow you want in natural language.\n\n**Example**: `@flow /create a code review with separate security and style lenses`');
			return {};
		}

		stream.progress('Generating flow...');

		try {
			this.log.trace('handleCreate: calling _generateFlowYaml');
			const result = await this._generateFlowYaml(description, request.model, token);

			if (!result) {
				this.log.error('_generateFlowYaml returned undefined — no language models available');
				stream.markdown('❌ No language model available. Please check your model configuration.');
				return {};
			}

			if (!result.valid) {
				stream.markdown('⚠️ **Warning**: The generated flow could not be fully validated, but the raw output has been saved. You may need to manually fix YAML issues.\n\n');
			}

			this.log.trace(`handleCreate: YAML generated, length=${result.content.length}`);
			const fileName = await this._writeFlowToWorkspace(result.content, stream);
			if (fileName) {
				const statusIcon = result.valid ? '✅' : '⚠️';
				this.log.info(`handleCreate: flow written to ${fileName} (valid=${result.valid})`);
				stream.markdown(`${statusIcon} Flow ${result.valid ? 'created' : 'saved'}: \`${fileName}\`\n\n`);
				stream.markdown(`Run it with: \`@flow #file:${fileName}\`\n\n`);
				if (!result.valid) {
					stream.markdown('> 💡 The generated YAML may have syntax issues. Open the file and fix any errors, or use `@flow /enhance` to refine it.\n\n');
				}
				stream.markdown('💡 **Next steps**:\n- Run the flow to see it in action\n- Edit the YAML to customize roles and prompts\n- Use `@flow /enhance` to add tools, stages, or integrations');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.log.error(err instanceof Error ? err : msg, 'handleCreate failed');
			stream.markdown(`❌ **Error**: ${msg}`);
		}

		return {};
	}

	/** `/enhance <instruction>` — enhance an existing flow from a natural language instruction. */
	private async handleEnhance(
		request: vscode.ChatRequest,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		const trimmed = request.prompt.trim();
		this.log.info(`handleEnhance: instruction="${trimmed.substring(0, 80)}" model=${request.model?.name}(${request.model?.id}) vendor=${request.model?.vendor}, refs=${request.references.length}`);

		if (!trimmed) {
			this.log.info('handleEnhance: empty instruction, returning usage');
			stream.markdown('**Usage**: `@flow /enhance <instruction>`\n\nAdd features to the active flow.\n\n**Example**: `@flow /enhance --add-jira-integration`');
			return {};
		}

		stream.progress('Enhancing flow...');

		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				this.log.error('handleEnhance: no workspace folder open');
				stream.markdown('❌ No workspace folder is open.');
				return {};
			}

			// Resolve attached references: flow file target + context files
			const { targetUri, targetName, contextFiles } = await this._resolveEnhanceReferences(request, workspaceFolder.uri);

			if (!targetUri) {
				this.log.error('handleEnhance: could not determine target flow file');
				return {};
			}

			this.log.trace(`handleEnhance: target=${targetName}, contextFiles=${contextFiles.length}`);

			// Read existing flow
			let existingContent: string;
			try {
				const bytes = await vscode.workspace.fs.readFile(targetUri);
				existingContent = Buffer.from(bytes).toString('utf8');
				this.log.trace(`handleEnhance: read existing flow, length=${existingContent.length}`);
			} catch {
				this.log.error(`handleEnhance: failed to read ${targetName}`);
				stream.markdown(`❌ Flow file \`${targetName}\` not found.`);
				return {};
			}

			// Build the instruction, stripping #file: markers (resolved via references)
			let instruction = this._cleanEnhancePrompt(trimmed);
			if (contextFiles.length > 0) {
				const ctxSection = contextFiles.map(f => `\n\n### Attached: ${f.label}\n\`\`\`\n${f.content}\n\`\`\``).join('');
				instruction = `${instruction}\n\nThe user attached the following files as reference context:${ctxSection}`;
			}

			this.log.trace('handleEnhance: calling _enhanceFlowYaml');
			const result = await this._enhanceFlowYaml(existingContent, instruction, request.model, token);
			if (!result) {
				this.log.error('_enhanceFlowYaml returned undefined — no language models available');
				stream.markdown('❌ No language model available. Please check your model configuration.');
				return {};
			}

			if (!result.valid) {
				stream.markdown('⚠️ **Warning**: The enhanced flow could not be fully validated, but the raw output has been saved. You may need to manually fix YAML issues.\n\n');
			}

			this.log.trace(`handleEnhance: YAML enhanced, length=${result.content.length}`);
			await vscode.workspace.fs.writeFile(targetUri, Buffer.from(result.content, 'utf8'));
			const statusIcon = result.valid ? '✅' : '⚠️';
			this.log.info(`handleEnhance: flow written back to ${targetName} (valid=${result.valid})`);
			stream.markdown(`${statusIcon} Enhanced \`${targetName}\`\n\n`);
			stream.markdown(`Run it with: \`@flow #file:${targetName}\``);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.log.error(err instanceof Error ? err : msg, 'handleEnhance failed');
			stream.markdown(`❌ **Error**: ${msg}`);
		}

		return {};
	}

	/**
	 * Resolve the target flow file and context files from the enhance request.
	 * Uses VS Code's built-in reference resolution (request.references) when
	 * files are attached via #file:.
	 */
	private async _resolveEnhanceReferences(
		request: vscode.ChatRequest,
		workspaceUri: vscode.Uri
	): Promise<{ targetUri: vscode.Uri | undefined; targetName: string; contextFiles: { label: string; content: string }[] }> {
		const flowsDir = vscode.Uri.joinPath(workspaceUri, '.github', 'flows');

		// Step 1: Try to resolve from VS Code's reference system (#file: attachments)
		let targetUri: vscode.Uri | undefined;
		let targetName = '';
		const contextFiles: { label: string; content: string }[] = [];

		for (const ref of request.references) {
			const uri = refToUri(ref);
			if (!uri) { continue; }

			const isFlowFile = uri.path.endsWith('.flow.yaml') || uri.path.endsWith('.flow.yml');
			if (isFlowFile && !targetUri) {
				targetUri = uri;
				targetName = vscode.workspace.asRelativePath(uri, false);
				continue;
			}

			// Non-flow reference → read as context
			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const content = Buffer.from(bytes).toString('utf8');
				const label = ref.modelDescription || vscode.workspace.asRelativePath(uri, false);
				contextFiles.push({ label, content });
				this.log.trace(`_resolveEnhanceReferences: attached context file ${label}`);
			} catch {
				this.log.trace(`_resolveEnhanceReferences: unable to read ${uri.fsPath}, skipping`);
			}
		}

		if (targetUri) {
			return { targetUri, targetName, contextFiles };
		}

		// Step 2: Fallback — parse prompt text for filename patterns
		const trimmed = request.prompt.trim();
		const words = trimmed.split(/\s+/);
		let firstWord = words[0];

		if (firstWord.startsWith('#file:')) {
			firstWord = firstWord.slice('#file:'.length);
		}

		let flowFiles: [string, vscode.Uri][] = [];
		try {
			const entries = await vscode.workspace.fs.readDirectory(flowsDir);
			flowFiles = entries
				.filter(([name]) => name.endsWith('.flow.yaml'))
				.map(([name]) => [name, vscode.Uri.joinPath(flowsDir, name)] as [string, vscode.Uri]);
		} catch {
			this.log.error('_resolveEnhanceReferences: .github/flows/ not found');
		}

		if (firstWord.endsWith('.flow.yaml') || firstWord.endsWith('.flow.yml')) {
			const match = flowFiles.find(([name]) => name === firstWord);
			targetUri = match ? match[1] : vscode.Uri.joinPath(flowsDir, firstWord);
			targetName = firstWord;
		} else if (flowFiles.length === 1) {
			targetUri = flowFiles[0][1];
			targetName = flowFiles[0][0];
		} else if (flowFiles.length > 1) {
			this.log.error(`_resolveEnhanceReferences: multiple flows (${flowFiles.length}) in .github/flows/ and no target specified`);
		} else {
			this.log.error('_resolveEnhanceReferences: no .flow.yaml files found and no reference attached');
		}

		return { targetUri, targetName, contextFiles };
	}

	/** Result from flow generation, valid or not. */
	private static readonly _NO_MODEL: undefined = undefined;

	/** Maximum retry rounds when the LLM produces invalid YAML. */
	private static _maxGenerationRetriesCache: number | undefined;

	private static _retries(): number {
		const v = FlowParticipant._maxGenerationRetriesCache;
		if (v !== undefined) { return v; }
		return FlowParticipant._maxGenerationRetriesCache = getMaxGenerationRetries();
	}

	/**
	 * Strip VS Code chat-reference markers (#file:) from the prompt text.
	 * These are UI decorators that don't belong in the LLM instruction.
	 * The actual file content is resolved via request.references separately.
	 */
	private _cleanEnhancePrompt(prompt: string): string {
		return prompt
			.replace(/#\w+(?:[\w-]*):\S+/g, '') // strip #file:, #folder:, #selection: etc
			.replace(/\s{2,}/g, ' ')              // collapse multiple spaces
			.trim();
	}

	/**
	 * Generate YAML from natural language description using Prompt-TSX.
	 * Returns `{ content: string; valid: boolean }` on success (content always present),
	 * or undefined if no model is available.
	 */
	private async _generateFlowYaml(
		description: string,
		userModel: vscode.LanguageModelChat,
		token: vscode.CancellationToken
	): Promise<{ content: string; valid: boolean } | undefined> {
		this.log.info(`_generateFlowYaml: userModel=${userModel.name}(${userModel.id}) vendor=${userModel.vendor}`);
		const model = await selectModel(undefined, userModel, this.log);
		if (!model) {
			this.log.error('_generateFlowYaml: selectModel returned undefined — no language models available');
			return undefined;
		}
		this.log.info(`_generateFlowYaml: selected model=${model.name}(${model.id}) vendor=${model.vendor}`);

		const schema = await this._loadSchema();
		const example = await this._loadExample();

		// Compute token budget from model's max input, reserving headroom for response
		const maxPromptTokens = Math.max(8192, (model.maxInputTokens || 32768) - 4096);

		this.log.trace('_generateFlowYaml: calling renderPrompt');
		const { messages: initialMessages } = await renderPrompt(
			FlowAuthoringSkill,
			{ description, schema, example },
			{ modelMaxPromptTokens: maxPromptTokens },
			model
		);
		this.log.trace(`_generateFlowYaml: renderPrompt returned ${initialMessages.length} messages`);

		let lastError = '';
		let lastRawYaml = '';
		let allMessages = initialMessages;

		for (let attempt = 0; attempt < FlowParticipant._retries(); attempt++) {
			if (token.isCancellationRequested) { return undefined; }

			this.log.trace(`_generateFlowYaml: attempt ${attempt + 1}/${FlowParticipant._retries()}`);
			const response = await model.sendRequest(allMessages, {}, token);
			let text = '';
			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					text += chunk.value;
				}
			}
			this.log.trace(`_generateFlowYaml: model response length=${text.length}`);

			const rawYaml = this._extractYamlBlock(text);
			lastRawYaml = rawYaml;
			this.log.trace(`_generateFlowYaml: extracted YAML, length=${rawYaml.length}`);

			const validationError = this._validateFlowYamlWithError(rawYaml);
			if (!validationError) {
				this.log.info(`_generateFlowYaml: validation passed on attempt ${attempt + 1}, YAML length=${rawYaml.length}`);
				return { content: rawYaml, valid: true };
			}

			lastError = validationError;
			this.log.error(`_generateFlowYaml: validation failed on attempt ${attempt + 1}: ${validationError}`);

			if (attempt < FlowParticipant._retries() - 1) {
				const fixPrompt = new vscode.LanguageModelChatMessage(
					vscode.LanguageModelChatMessageRole.User,
					`The YAML you generated failed validation. Error:\n${validationError}\n\n` +
					`Fix rules:\n` +
					`- Output ONLY the raw YAML — NO @flow prefix, NO markdown fences, NO commentary.\n` +
					`- The root must be a mapping starting with name:, NOT a list.\n` +
					`- Role prompts use YAML block scalars (|). Their content lines must be indented 2+ spaces.\n` +
					`- If sharedContext contains code blocks, their content must be further indented under the | scalar.\n` +
					`After prompt: |, every continuation line MUST have at least 2 spaces of indentation.`
				);
				allMessages = [...initialMessages, ...allMessages.slice(initialMessages.length), fixPrompt];
			}
		}

		this.log.error(`_generateFlowYaml: all ${FlowParticipant._retries()} attempts failed. Last error: ${lastError}`);
		return { content: lastRawYaml || '', valid: false };
	}

	/** Enhance an existing flow using Prompt-TSX. */
	private async _enhanceFlowYaml(
		existingContent: string,
		instruction: string,
		userModel: vscode.LanguageModelChat,
		token: vscode.CancellationToken
	): Promise<{ content: string; valid: boolean } | undefined> {
		this.log.info(`_enhanceFlowYaml: userModel=${userModel.name}(${userModel.id}) vendor=${userModel.vendor}, instruction="${instruction.substring(0, 80)}"`);
		const model = await selectModel(undefined, userModel, this.log);
		if (!model) {
			this.log.error('_enhanceFlowYaml: selectModel returned undefined — no language models available');
			return undefined;
		}
		this.log.info(`_enhanceFlowYaml: selected model=${model.name}(${model.id}) vendor=${model.vendor}`);

		const schema = await this._loadSchema();
		const example = await this._loadExample();
		const description = `Enhance this existing flow YAML:\n\n\`\`\`yaml\n${existingContent}\n\`\`\`\n\nInstruction: ${instruction}`;

		// Token budget from model, with generous headroom
		const maxPromptTokens = Math.max(8192, (model.maxInputTokens || 32768) - 4096);

		this.log.trace(`_enhanceFlowYaml: calling renderPrompt (maxPromptTokens=${maxPromptTokens})`);
		const { messages: initialMessages } = await renderPrompt(
			FlowAuthoringSkill,
			{ description, schema, example },
			{ modelMaxPromptTokens: maxPromptTokens },
			model
		);
		this.log.trace(`_enhanceFlowYaml: renderPrompt returned ${initialMessages.length} messages`);

		if (initialMessages.length === 0) {
			this.log.error('_enhanceFlowYaml: renderPrompt returned 0 messages — existing flow may be too large for token budget');
			return undefined;
		}

		let lastError = '';
		let lastRawYaml = '';
		let allMessages = initialMessages;

		for (let attempt = 0; attempt < FlowParticipant._retries(); attempt++) {
			if (token.isCancellationRequested) { return undefined; }

			this.log.trace(`_enhanceFlowYaml: attempt ${attempt + 1}/${FlowParticipant._retries()}`);
			const response = await model.sendRequest(allMessages, {}, token);
			let text = '';
			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					text += chunk.value;
				}
			}
			this.log.trace(`_enhanceFlowYaml: model response length=${text.length}`);

			const rawYaml = this._extractYamlBlock(text);
			lastRawYaml = rawYaml;
			this.log.trace(`_enhanceFlowYaml: extracted YAML, length=${rawYaml.length}`);

			const validationError = this._validateFlowYamlWithError(rawYaml);
			if (!validationError) {
				this.log.info(`_enhanceFlowYaml: validation passed on attempt ${attempt + 1}, YAML length=${rawYaml.length}`);
				return { content: rawYaml, valid: true };
			}

			lastError = validationError;
			this.log.error(`_enhanceFlowYaml: validation failed on attempt ${attempt + 1}: ${validationError}`);

			if (attempt < FlowParticipant._retries() - 1) {
				const fixPrompt = new vscode.LanguageModelChatMessage(
					vscode.LanguageModelChatMessageRole.User,
					`The YAML you generated failed validation. Error:\n${validationError}\n\n` +
					`Fix rules:\n` +
					`- Output ONLY the raw YAML — NO @flow prefix, NO markdown fences, NO commentary.\n` +
					`- The root must be a mapping starting with name:, NOT a list.\n` +
					`- Role prompts use YAML block scalars (|). Their content lines must be indented 2+ spaces.\n` +
					`- If sharedContext contains code blocks, their content must be further indented under the | scalar.\n` +
					`After prompt: |, every continuation line MUST have at least 2 spaces of indentation.`
				);
				allMessages = [...initialMessages, ...allMessages.slice(initialMessages.length), fixPrompt];
			}
		}

		this.log.error(`_enhanceFlowYaml: all ${FlowParticipant._retries()} attempts failed. Last error: ${lastError}`);
		return { content: lastRawYaml || '', valid: false };
	}

	/** Load the flow JSON schema from the extension bundle. */
	private async _loadSchema(): Promise<string> {
		try {
			const schemaUri = vscode.Uri.joinPath(this.context.extensionUri, 'schemas', 'flow.schema.json');
			const bytes = await vscode.workspace.fs.readFile(schemaUri);
			return Buffer.from(bytes).toString('utf8');
		} catch {
			return '';
		}
	}

	/** Load an example flow from the extension bundle. */
	private async _loadExample(): Promise<string> {
		try {
			const exampleUri = vscode.Uri.joinPath(this.context.extensionUri, 'examples', '01-pipeline-review.flow.yaml');
			const bytes = await vscode.workspace.fs.readFile(exampleUri);
			return Buffer.from(bytes).toString('utf8');
		} catch {
			return '';
		}
	}

	/** Extract YAML from model output (handles markdown fences and raw YAML). */
	private _extractYamlBlock(text: string): string {
		// Step 1: Strip any leading lines that start with `@flow` (the model
		// sometimes emits `@flow #file:...` as a lead-in before the YAML).
		let cleaned = text;
		const lines = cleaned.split('\n');
		const firstContentLine = lines.findIndex(l => !/^\s*$/.test(l) && !/^\s*@flow\b/.test(l.trim()));
		if (firstContentLine > 0) {
			cleaned = lines.slice(firstContentLine).join('\n');
		}

		// Step 2: If the content starts with a markdown code fence, extract
		// everything up to the LAST closing fence — not the first, because
		// sharedContext templates contain nested ``` blocks.
		const openMatch = cleaned.match(/^```(?:ya?ml?)?\s*\n/);
		if (openMatch) {
			const afterOpen = cleaned.substring(openMatch.index! + openMatch[0].length);
			// Find the LAST ``` — this handles nested fences inside block scalars
			const lastFenceIdx = afterOpen.lastIndexOf('\n```');
			if (lastFenceIdx >= 0) {
				const result = afterOpen.substring(0, lastFenceIdx).trim();
				this.log.trace(`_extractYamlBlock: matched fence (last), extracted length=${result.length}`);
				return result;
			}
			// If no closing fence found at all, return everything after opening
			const result = afterOpen.trim();
			this.log.trace(`_extractYamlBlock: no closing fence, extracted length=${result.length}`);
			return result;
		}

		// Step 3: Raw YAML — find the document start ("name:"), stop at trailing
		// non-YAML content (e.g. "@flow #file:..." or "> suggestions").
		const rawLines = cleaned.trim().split('\n');
		const startIdx = rawLines.findIndex(l => l.trim().startsWith('name:'));
		if (startIdx >= 0) {
			let endIdx = rawLines.length;
			for (let i = startIdx + 1; i < rawLines.length; i++) {
				const tr = rawLines[i].trim();
				if (tr.startsWith('@flow') || tr.startsWith('@') || tr.startsWith('> ')) {
					endIdx = i;
					break;
				}
			}
			const result = rawLines.slice(startIdx, endIdx).join('\n').trim();
			this.log.trace(`_extractYamlBlock: raw YAML lines ${startIdx}-${endIdx}, extracted length=${result.length}`);
			return result;
		}
		this.log.trace(`_extractYamlBlock: no fence or name: marker found, returning raw text (length=${cleaned.trim().length})`);
		return cleaned.trim();
	}

	/** Validate YAML against flow schema. Returns error message or undefined on success. */
	private _validateFlowYamlWithError(content: string): string | undefined {
		try {
			const parsed = yaml.load(content);
			if (!parsed || typeof parsed !== 'object') {
				return `YAML parsed to non-object type: ${typeof parsed}. Content must be a valid YAML mapping.`;
			}
			const obj = parsed as Record<string, unknown>;
			if (!obj.name || typeof obj.name !== 'string') {
				return `Missing required 'name' field (must be a string). Found keys: ${Object.keys(obj).join(', ')}`;
			}
			if (!obj.roles && !obj.stages && !obj.groups) {
				return `Missing structural key. Must have one of 'roles', 'stages', or 'groups'. Found keys: ${Object.keys(obj).join(', ')}`;
			}
			return undefined; // success
		} catch (err) {
			return `YAML syntax error: ${err instanceof Error ? err.message : String(err)}`;
		}
	}

	/** Validate YAML against flow schema. Returns valid YAML or undefined. */
	private _validateFlowYaml(content: string): string | undefined {
		const error = this._validateFlowYamlWithError(content);
		if (error) {
			this.log.error(`_validateFlowYaml: ${error}`);
			return undefined;
		}
		const parsed = yaml.load(content) as Record<string, unknown>;
		this.log.trace(`_validateFlowYaml: valid. name=${parsed.name}, keys=${Object.keys(parsed).join(', ')}`);
		return content;
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