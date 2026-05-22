/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IFlowConfig, ISkillRef, IAgentRef, IContextRef, IRoleResponse, FlowService } from './flowService';
import { FlowContextBuilder, IFlowContext } from '../context/flowContextBuilder';
import { FlowConversationStore, FlowConversation, FlowTurn } from '../session/flowConversation';
import { ContextFile, FlowPromptRenderer } from '../prompts/flowPromptRenderer';
import { ToolCallRound } from '../prompts/flowTools';
import { normalizeToolSchemas } from '../util/toolSchemaNormalizer';
import { filterTools, shouldFilterTools } from '../util/toolFilter';
import { CopilotSdkExecutor } from '../util/copilotSdkExecutor';
import { FlowLibrary } from './flowLibrary';

/**
 * Chat participant that orchestrates flow discussions
 */
export class FlowParticipant {
	private readonly flowService: FlowService;
	private readonly contextBuilder: FlowContextBuilder;
	private readonly conversationStore: FlowConversationStore;
	private readonly promptRenderer: FlowPromptRenderer;
	private readonly sdkExecutor: CopilotSdkExecutor;
	private readonly library: FlowLibrary;

	/** Cached from the last successful request so retries without the reference still work. */
	private lastFlowUri: vscode.Uri | undefined;
	/** Stable session ID reused while the same VS Code chat conversation is active. */
	private currentSessionId: string | undefined;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.flowService = new FlowService();
		this.contextBuilder = new FlowContextBuilder();
		this.conversationStore = new FlowConversationStore();
		this.promptRenderer = new FlowPromptRenderer();
		this.sdkExecutor = new CopilotSdkExecutor();
		this.library = new FlowLibrary(context);
	}
	
	/**
	 * Register the @flow participant
	 */
	register(): vscode.Disposable {
		const participant = vscode.chat.createChatParticipant(
			'ix.copilot-ai-flow',
			this.handleRequest.bind(this)
		);
		
		participant.iconPath = new vscode.ThemeIcon('organization');
		
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

			// Step 1: Find the flow file (URI-based, or name-based search in .github/flows/)
			const flowFileUri = await this.findFlowFile(request, context, token);
			
			if (!flowFileUri) {
				stream.markdown('**Usage**: Reference a flow file or provide its name.\n\n');
				stream.markdown('- Attach a file: `@flow #file:./my-flow.flow.yaml What should we do?`\n\n');
				stream.markdown('- Use a name: `@flow sdd-spec-kit` (searches `.github/flows/`)\n\n');
				stream.markdown('Open the gallery: `AI Flow: Open Flow Gallery`');
				return {};
			}
			
			// Step 2: Parse the flow configuration
			stream.progress('Parsing flow configuration...');
			const config = await this.flowService.parsePrompt(flowFileUri);
			
			if (!config) {
				stream.markdown('❌ **Error**: Failed to parse flow file. Please check the format.');
				return { errorDetails: { message: 'Invalid flow file format' } };
			}
			
			// Step 3: Validate configuration
			const validation = this.flowService.validate(config);
			if (!validation.valid) {
				stream.markdown('❌ **Validation Errors**:\n\n');
				for (const error of validation.errors) {
					stream.markdown(`- ${error}\n`);
				}
				return { errorDetails: { message: 'Invalid flow configuration' } };
			}
			
			// Step 4: Show what we're doing
			stream.markdown(`## ${config.name}\n\n`);
			if (config.description) {
				stream.markdown(`${config.description}\n\n`);
			}
			if (config.stages) {
				stream.markdown(`**Stages**: ${config.stages.map(s => `${s.name} (×${s.iterations ?? 1})`).join(' → ')}\n\n`);
			} else {
				stream.markdown(`**Flow**: ${config.roles.map(r => r.name).join(', ')}\n\n`);
			}
			stream.markdown(`**Mode**: ${config.orchestration}\n\n`);
			
			// Show CLI-specific properties
			if (config.orchestration === 'cli') {
				if (config.isolation) {
					stream.markdown(`**Isolation**: ${config.isolation}\n\n`);
				}
				if (config.cliMode) {
					stream.markdown(`**CLI Mode**: ${config.cliMode}\n\n`);
				}
				if (config.model) {
					stream.markdown(`**Model**: ${config.model}\n\n`);
				}
				if (config.customAgent) {
					stream.markdown(`**Agent**: ${config.customAgent}\n\n`);
				}
			}
			
			if (config.tools && config.tools.length > 0) {
				stream.markdown(`**Tools**: ${config.tools.join(', ')}\n\n`);
			}
			
			stream.markdown('---\n\n');
			
			// Step 5: Build rich context and manage conversation
			const vsCodeContext = this.contextBuilder.buildContext(request);
			// Derive a stable session ID. When history is empty this is a fresh conversation;
			// on retries or follow-up turns the history is non-empty and we reuse the same ID.
			if (context.history.length === 0) {
				this.currentSessionId = 'session-' + Date.now();
			}
			const sessionId = this.currentSessionId ?? 'session-default';
			const conversation = this.conversationStore.getOrCreate(sessionId);
			const currentTurn = conversation.addTurn(request.prompt, vsCodeContext);
			
			// Step 6: Execute the orchestration strategy
			if (token.isCancellationRequested) {
				return {};
			}
			
			switch (config.orchestration) {
				case 'sequence':
					if (config.stages) {
						await this.executeStages(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token, request.toolInvocationToken, request.model);
					} else {
						await this.executeSequential(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token, request.toolInvocationToken, request.model);
					}
					break;
				case 'cli':
					await this.executeCli(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token);
					break;
			}
			
			return {
				metadata: {
					roles: config.stages
						? config.stages.flatMap(s => s.roles.map(r => r.name))
						: config.roles.map(r => r.name),
					orchestration: config.orchestration,
					category: config.category
				}
			};
			
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

	// ------------------------------------------------------------------

	/**
	 * Extract a URI from a ChatPromptReference using duck-typing (same approach
	 * as the Copilot extension) instead of instanceof, which can fail across
	 * different module instances in the extension host.
	 *
	 * VS Code's toFileVariableEntry() sets id = uri.toString(), so when a
	 * reference becomes "unlinked" on retry (value is undefined/null) the id
	 * still carries the full URI string — we fall back to parsing that.
	 */
	private refToUri(ref: vscode.ChatPromptReference): vscode.Uri | undefined {
		const v = ref.value;
		if (v && typeof v === 'object') {
			// Uri: has scheme + path (duck-type, mirrors URI.isUri in vscode-copilot-chat)
			if ('scheme' in v && 'path' in v) {
				try { return vscode.Uri.from(v as vscode.Uri); } catch { /* ignore */ }
			}
			// Location: has uri + range
			if ('uri' in v && 'range' in v) {
				const loc = v as { uri: unknown };
				if (loc.uri && typeof loc.uri === 'object' && 'scheme' in loc.uri && 'path' in loc.uri) {
					try { return vscode.Uri.from(loc.uri as vscode.Uri); } catch { /* ignore */ }
				}
			}
		}
		// Fallback: ref.id is uri.toString() for file references — try parsing it.
		// This recovers "unlinked" references where value is undefined/null but
		// the id still contains the original URI (e.g. "file:///path/to/panel.yaml").
		// This recovers unlinked references on retry.
		if (typeof ref.id === 'string' && ref.id.startsWith('file:')) {
			try { return vscode.Uri.parse(ref.id, /*strict*/ true); } catch { /* ignore */ }
		}
		return undefined;
	}

	/** Scan a list of references and return the best flow-file URI. */
	private scanRefs(refs: readonly vscode.ChatPromptReference[]): vscode.Uri | undefined {
		let fallback: vscode.Uri | undefined;
		for (const ref of refs) {
			const uri = this.refToUri(ref);
			if (!uri) { continue; }
			const lp = uri.path.toLowerCase();
			if (lp.endsWith('.flow.yaml') || lp.endsWith('.flow.yml')) { return uri; }
			if (!fallback && lp.endsWith('.md')) { fallback = uri; }
		}
		return fallback;
	}

	/**
	 * Find the .flow.yaml file for the current request.
	 * Resolution order:
	 *   1. Direct URI reference (`#file:` attachment in current request)
	 *   2. URI reference from chat history
	 *   3. Name-based fuzzy search in `.github/flows/` (matched against request.prompt)
	 *   4. Cached URI from the most recent successful request (retry fallback)
	 */
	private async findFlowFile(
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		token: vscode.CancellationToken
	): Promise<vscode.Uri | undefined> {
		// 1. Current request references (URI-based)
		const fromRequest = this.scanRefs(request.references);
		if (fromRequest) {
			this.lastFlowUri = fromRequest;
			return fromRequest;
		}

		// 2. History — search backwards; the most recent turn with a flow file wins
		for (let i = context.history.length - 1; i >= 0; i--) {
			const turn = context.history[i];
			if (turn instanceof vscode.ChatRequestTurn) {
				const fromHistory = this.scanRefs(turn.references);
				if (fromHistory) {
					this.lastFlowUri = fromHistory;
					return fromHistory;
				}
			}
		}

		// 3. Name-based search in .github/flows/ across all workspace folders
		const name = request.prompt.trim();
		if (name && !token.isCancellationRequested) {
			const matches = await this.findFlowsByName(name);
			if (matches.length === 1) {
				this.lastFlowUri = matches[0];
				return matches[0];
			}
			if (matches.length > 1) {
				const items = matches.map(uri => ({
					label: path.basename(uri.fsPath).replace(/\.flow\.(yaml|yml)$/, ''),
					description: vscode.workspace.asRelativePath(uri),
					uri,
				}));
				const picked = await vscode.window.showQuickPick(items, {
					placeHolder: `Multiple flows match "${name}" — pick one to run`,
					title: 'Select Flow',
				});
				if (picked) {
					this.lastFlowUri = picked.uri;
					return picked.uri;
				}
				return undefined; // User dismissed the picker
			}
		}

		// 4. Last-resort: cached URI from a previous successful request
		//    (handles retries where VS Code omits the reference entirely)
		if (this.lastFlowUri) {
			console.log(`[FlowParticipant] No flow reference found — reusing cached URI: ${this.lastFlowUri.fsPath}`);
		}
		return this.lastFlowUri;
	}

	/** Fuzzy-search `.github/flows/` in all workspace folders for `*.flow.yaml` files whose stem matches `name`. */
	private async findFlowsByName(name: string): Promise<vscode.Uri[]> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) { return []; }

		const query = name.toLowerCase().trim();
		const queryWords = query.split(/[\s\-_]+/).filter(w => w.length > 2);
		const results: vscode.Uri[] = [];

		for (const folder of workspaceFolders) {
			const flowsDir = vscode.Uri.joinPath(folder.uri, '.github', 'flows');
			try {
				const entries = await vscode.workspace.fs.readDirectory(flowsDir);
				for (const [filename, type] of entries) {
					if (type !== vscode.FileType.File) { continue; }
					if (!filename.endsWith('.flow.yaml') && !filename.endsWith('.flow.yml')) { continue; }
					const stem = filename.replace(/\.flow\.(yaml|yml)$/, '').toLowerCase();
					if (stem.includes(query) || query.includes(stem) || queryWords.some(w => stem.includes(w))) {
						results.push(vscode.Uri.joinPath(flowsDir, filename));
					}
				}
			} catch {
				// .github/flows/ doesn't exist in this workspace folder — skip
			}
		}
		return results;
	}
	
	/**
	 * Get tools array from flow config
	 */
	private getFlowTools(config: IFlowConfig): { tools: vscode.LanguageModelChatTool[] | undefined; missingTools: ReadonlyArray<string> } {
		if (!config.tools || config.tools.length === 0) {
			return { tools: undefined, missingTools: [] };
		}
		
		// Get all available tools - this could be undefined
		const allTools = vscode.lm.tools;
		if (!allTools) {
			console.warn('[FlowParticipant] vscode.lm.tools is undefined');
			return { tools: undefined, missingTools: config.tools ?? [] };
		}
		
		// Handle wildcard '*' to include all tools
		if (config.tools.includes('*')) {
			console.log(`[FlowParticipant] Wildcard '*' detected - ${allTools.length} tools available`);
			// Note: We'll apply smart filtering later with the query context
			return { tools: [...allTools], missingTools: [] };
		}
		
		// Filter to requested tools
		const matchedTools = allTools.filter(tool => 
			config.tools?.includes(tool.name)
		);
		
		// Find unmatched tools
		const unmatchedTools = config.tools.filter(name => 
			!allTools.some(tool => tool.name === name)
		);
		
		if (unmatchedTools.length > 0) {
			console.warn('[FlowParticipant] Tools not found:', unmatchedTools);
		}
		
		// Return undefined if no tools matched (prevents empty array)
		return {
			tools: matchedTools.length > 0 ? matchedTools : undefined,
			missingTools: unmatchedTools
		};
	}
	
	/**
	 * Sequential orchestration: roles respond one after another
	 */
	private async executeSequential(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		conversation: FlowConversation,
		currentTurn: FlowTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
		currentChatModel: vscode.LanguageModelChat
	): Promise<void> {
		
		const { tools, missingTools } = this.getFlowTools(config);
		
		// Warn user about missing tools
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: The following tools are not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
			stream.markdown(`💡 **Tip**: Run the command "AI Flow: List Available Tools" to see registered tools.\n\n`);
		}
		
		for (const role of config.roles) {
			if (token.isCancellationRequested) {
				return;
			}

			const roleSkillRefs = [...(config.skills ?? []), ...(role.skills ?? [])];
			const roleContextRefs = [...(config.contexts ?? []), ...(role.contexts ?? [])];
			// Augment system prompt: resolve agent file + inject skills + substitute $ARGUMENTS.
			// Context files are resolved separately and injected by the prompt-tsx renderer
			// at a lower priority so they are dropped gracefully when the token budget is tight.
			const augmentedSystemPrompt = await this.buildAugmentedSystemPrompt(
				role,
				roleSkillRefs,
				config.promptUri,
				userQuery,
				token
			);
			const flowDocContextFiles = await this.resolveContextFiles(roleContextRefs, config.promptUri, token);
			const refContextFiles = await this.resolveReferenceFiles(vsCodeContext.references, config.promptUri, token);
			const contextFiles = [...refContextFiles, ...flowDocContextFiles];
			const augmentedRole = { name: role.name, prompt: augmentedSystemPrompt, model: role.model };

			// Output the role header before calling the model so streamed text
			// appears under it in real-time rather than only showing after completion.
			stream.markdown(`### ${role.name}\n\n`);
			stream.progress(`${role.name} is thinking...`);
			
			const response = await this.callRole(
				augmentedRole, 
				userQuery, 
				vsCodeContext, 
				config.sharedContext,
				contextFiles,
				conversation.getHistory().slice(0, -1), // Exclude current turn
				tools,
				stream,
				token,
				toolInvocationToken,
				currentChatModel
			);
			
			// Save response
			currentTurn.responses.set(role.name, response.content);
			
			// Content was already streamed live inside callRole(); only show error
			// or a trailing newline before the model attribution.
			if (response.error) {
				stream.markdown(`*Error: ${response.error}*\n\n`);
			} else {
				stream.markdown('\n\n');
			}
			
			if (response.model) {
				stream.markdown(`*<sub>Model: ${response.model}</sub>*\n\n`);
			}
			stream.markdown('---\n\n');
		}
	}
	
	/**
	 * CLI orchestration: SDK/CLI delegation with background agent support
	 * All roles execute via GitHub Copilot SDK with session persistence
	 */
	private async executeCli(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		conversation: FlowConversation,
		currentTurn: FlowTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<void> {
		
		stream.progress('Flow executing via GitHub Copilot SDK...');
		
		const history = conversation.getHistory().slice(0, -1);
		
		// Validate SDK availability
		const availability = await this.sdkExecutor.checkAvailability();
		if (!availability.available) {
			stream.markdown(`⚠️ **SDK Mode Error**: ${availability.error}\n\n`);
			stream.markdown(`💡 **Note**: CLI orchestration requires GitHub Copilot SDK. Please ensure:\n`);
			stream.markdown(`- GitHub CLI is installed and authenticated\n`);
			stream.markdown(`- GitHub Copilot subscription is active\n\n`);
			return;
		}
		
		// Show execution mode
		const mode = config.cliMode || 'supervised';
		const isolation = config.isolation || 'workspace';
		stream.markdown(`✅ Using GitHub Copilot SDK (${mode} mode, ${isolation} isolation)\n\n`);
		
		// TODO: Implement worktree isolation if config.isolation === 'worktree'
		// TODO: Implement permission handling based on config.cliMode
		// TODO: Use config.model and config.customAgent for SDK options
		
		// Call all roles in parallel using SDK
		const responsePromises = config.roles.map(role => 
			this.callRoleSdk(
				{ name: role.name, prompt: role.prompt ?? '', model: role.model },
				userQuery, vsCodeContext, config.sharedContext, history, stream, token
			)
		);
		
		const responses = await Promise.all(responsePromises);
		
		// Render all responses
		for (let i = 0; i < config.roles.length; i++) {
			if (token.isCancellationRequested) {
				return;
			}
			
			const role = config.roles[i];
			const response = responses[i];
			
			// Save response
			currentTurn.responses.set(role.name, response.content);
			
			stream.markdown(`### ${role.name}\n\n`);
			if (response.error) {
				stream.markdown(`*Error: ${response.error}*\n\n`);
			} else {
				stream.markdown(`${response.content}\n\n`);
			}
			
			if (response.model) {
				stream.markdown(`*<sub>Model: ${response.model}</sub>*\n\n`);
			}
			stream.markdown('---\n\n');
		}
		
		// TODO: Commit worktree changes if isolation === 'worktree' and execution successful
	}
	
	/**
	 * Call a role using GitHub Copilot SDK
	 * Simpler execution without tool loops - SDK handles everything
	 */
	private async callRoleSdk(
		role: { name: string; prompt: string; model?: string },
		userQuery: string,
		vsCodeContext: IFlowContext,
		sharedContext: string,
		history: FlowTurn[],
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<IRoleResponse> {
		try {
			// Execute via SDK
			const result = await this.sdkExecutor.executeCopilotSdk({
				roleName: role.name,
				prompt: role.prompt,
				userQuery,
				context: vsCodeContext,
				sharedContext,
				history,
				model: role.model,
				token,
				onProgress: (message) => {
					stream.progress(message);
				}
			});
			
			return result;
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[FlowParticipant] Error in callRoleSdk for ${role.name}:`, error);
			return {
				roleName: role.name,
				content: '',
				model: role.model || 'claude-sonnet-4.5',
				error: errorMessage
			};
		}
	}
	
	/**
	 * Call a language model for a specific role using Prompt-TSX
	 * Handles tool execution loop: model requests tools, we execute them, send results back
	 */
	private async callRole(
		role: { name: string; prompt: string; model?: string },
		userQuery: string,
		vsCodeContext: IFlowContext,
		sharedContext: string,
		contextFiles: ContextFile[],
		history: FlowTurn[],
		tools: vscode.LanguageModelChatTool[] | undefined,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
		currentChatModel: vscode.LanguageModelChat
	): Promise<IRoleResponse> {
		
		try {
			// Model selection: if the role specifies a model name, find a matching candidate;
			// otherwise fall back to the model the user currently has selected in the chat UI.
			let model: vscode.LanguageModelChat;
			if (role.model) {
				const modelName = role.model;
				let allCandidates = await vscode.lm.selectChatModels({ vendor: 'copilot' });
				if (allCandidates.length === 0) {
					allCandidates = await vscode.lm.selectChatModels();
				}
				const nameLower = modelName.toLowerCase();
				const found =
					allCandidates.find(m => m.name.toLowerCase() === nameLower || m.id.toLowerCase() === nameLower) ??
					allCandidates.find(m => m.family.toLowerCase().includes(nameLower) || nameLower.includes(m.family.toLowerCase())) ??
					allCandidates[0];
				if (!found) {
					return { roleName: role.name, content: '', model: modelName, error: 'No language model available' };
				}
				model = found;
			} else {
				// No model override in the role — use whatever the user has selected in chat
				model = currentChatModel;
			}

			// Reserve tokens for the model's response; use the model's actual input limit
			const rawMaxInput = model.maxInputTokens || 32768; // fallback if unset/zero
			const maxPromptTokens = rawMaxInput > 16384
				? rawMaxInput - 8192   // leave ~8K tokens for response
				: Math.floor(rawMaxInput * 0.75);
			console.log(`[FlowParticipant] Model: ${model.name}, maxInputTokens=${model.maxInputTokens}, using maxPromptTokens=${maxPromptTokens}`);
			
			// Tool execution loop: continue until no more tool calls
			let responseText = '';
			const maxToolRounds = 15; // Reasonable limit; model should converge well before this
			let toolRound = 0;
			const toolCallRounds: ToolCallRound[] = [];
			let toolCallResults: Record<string, vscode.LanguageModelToolResult> = {};
			
			while (toolRound < maxToolRounds) {
				if (token.isCancellationRequested) {
					break;
				}
				
				console.log(`[FlowParticipant] Starting tool round ${toolRound + 1} of ${maxToolRounds} for role ${role.name}`);
				console.log(`[FlowParticipant] Current state: ${toolCallRounds.length} rounds, ${Object.keys(toolCallResults).length} cached results`);

			// Render prompt using Prompt-TSX
			const renderResult = await this.promptRenderer.renderRolePrompt(
				role.name,
				role.prompt,
				userQuery,
				vsCodeContext,
				sharedContext,
				contextFiles,
				history,
				maxPromptTokens,
				toolCallRounds,
				toolCallResults,
				toolInvocationToken
			);
			
			console.log(`[FlowParticipant] Prompt rendered: ${renderResult.messages.length} messages, ${Object.keys(renderResult.toolCallResults).length} tool results`);
			
				// Feed computed tool results back so they are cached on the next render round
				// (avoids re-invoking tools already executed in this or prior rounds)
				toolCallResults = { ...toolCallResults, ...renderResult.toolCallResults };
				
				const messages = renderResult.messages;
				
				if (messages.length === 0) {
					console.error(`[FlowParticipant] renderPrompt returned 0 messages for ${role.name} — aborting`);
					return { roleName: role.name, content: '', model: model.name, error: 'No prompt messages generated' };
				}
				// Check runtime tool-calling capability.
				// LanguageModelChatInformation.capabilities.toolCalling (boolean | number) is not
				// exposed on the LanguageModelChat interface, but Copilot may attach it at runtime.
				const runtimeCaps = (model as unknown as { capabilities?: { toolCalling?: boolean | number } }).capabilities;
				const modelSupportsTools = runtimeCaps ? runtimeCaps.toolCalling !== false : true;
				if (!modelSupportsTools) {
					console.warn(`[FlowParticipant] Model ${model.name} reports toolCalling=false — skipping tools to avoid empty response`);
				}

				// Build request options with tools if available
				const options: vscode.LanguageModelChatRequestOptions = {};
				if (tools && tools.length > 0 && modelSupportsTools) {
					// Apply smart tool filtering based on query if we have too many tools
					let filteredTools = tools;
					if (shouldFilterTools(tools.length)) {
						console.log(`[FlowParticipant] Applying smart tool filtering (${tools.length} -> max 128)`);
						filteredTools = filterTools(tools, userQuery);
					}
					
					// Normalize tool schemas to avoid "object schema missing properties" error
					const normalizedTools = normalizeToolSchemas(filteredTools);
					options.tools = normalizedTools;
					console.log(`[FlowParticipant] Using ${normalizedTools.length} tools: ${normalizedTools.map(t => t.name).join(', ')}`);
					// Log schema size for each tool to spot oversized/invalid schemas
					for (const t of normalizedTools) {
						const schemaStr = JSON.stringify(t.inputSchema ?? {});
						console.log(`[FlowParticipant]   tool "${t.name}" schema size=${schemaStr.length}`);
					}
				}
				
// Resolve LanguageModelThinkingPart class at runtime — it's a proposed API
				// so it may not be in the stable type definitions, but IS available on the
				// vscode object when chatParticipantAdditions is in enabledApiProposals.
				// VS Code's own extHostLanguageModels.ts uses instanceof for detection.
				type ThinkingStream = { thinkingProgress: (d: { text?: string; id?: string; metadata?: Record<string, unknown> }) => void };
				const thinkingStream = typeof (stream as unknown as ThinkingStream).thinkingProgress === 'function'
					? (stream as unknown as ThinkingStream)
					: undefined;
				const ThinkingPartCtor = (vscode as unknown as Record<string, unknown>)['LanguageModelThinkingPart'] as (new (...args: unknown[]) => unknown) | undefined;

				const streamParts = async (req: vscode.LanguageModelChatResponse): Promise<{ text: string; calls: vscode.LanguageModelToolCallPart[] }> => {
					const calls: vscode.LanguageModelToolCallPart[] = [];
					let text = '';
					let thinkingActive = false;
					try {
						for await (const part of req.stream) {
							if (token.isCancellationRequested) { break; }
							if (part instanceof vscode.LanguageModelTextPart) {
								// Transition out of thinking mode when text starts flowing
								if (thinkingActive) {
									thinkingStream?.thinkingProgress({ id: '', text: '', metadata: { vscodeReasoningDone: true, stopReason: 'text' } });
									thinkingActive = false;
								}
								text += part.value;
								stream.markdown(part.value); // stream in real-time
							} else if (part instanceof vscode.LanguageModelToolCallPart) {
								calls.push(part);
								stream.progress(`🔧 ${part.name}(...)`);
								console.log(`[FlowParticipant] Received tool call: ${part.name} (callId: ${part.callId})`);
							} else if (part instanceof vscode.LanguageModelDataPart) {
								// Text-typed data parts carry actual response text (e.g. text/plain, text/markdown).
								if (part.mimeType.startsWith('text/')) {
									try {
										const decoded = new TextDecoder().decode(part.data);
										text += decoded;
										stream.markdown(decoded); // stream in real-time
									} catch { /* ignore malformed data */ }
								} else {
									console.log(`[FlowParticipant] DataPart mimeType="${part.mimeType}" — not extracting text`);
								}
							} else if (ThinkingPartCtor && part instanceof ThinkingPartCtor) {
								// LanguageModelThinkingPart — Claude extended thinking tokens.
								// Use instanceof with the runtime class (same as VS Code's extHostLanguageModels.ts).
								const thinkPart = part as { value: string | string[]; id?: string; metadata?: Record<string, unknown> };
								const thinkText = Array.isArray(thinkPart.value) ? thinkPart.value.join('') : (thinkPart.value ?? '');
								if (thinkingStream) {
									thinkingStream.thinkingProgress({ text: thinkText, id: thinkPart.id, metadata: thinkPart.metadata });
									thinkingActive = true;
								} else if (thinkText) {
									stream.markdown(`> 💭 ${thinkText}\n`);
								}
							} else if ((part as object)?.constructor?.name === 'LanguageModelThinkingPart') {
								// Constructor-name fallback: covers the case where ThinkingPartCtor is
								// undefined (proposed API not loaded) but the class is still emitted.
								const thinkPart = part as { value: string | string[]; id?: string; metadata?: Record<string, unknown> };
								const thinkText = Array.isArray(thinkPart.value) ? thinkPart.value.join('') : (thinkPart.value ?? '');
								if (thinkingStream) {
									thinkingStream.thinkingProgress({ text: thinkText, id: thinkPart.id, metadata: thinkPart.metadata });
									thinkingActive = true;
								} else if (thinkText) {
									stream.markdown(`> 💭 ${thinkText}\n`);
								}
							} else {
								console.log(`[FlowParticipant] Unknown stream part type: ${(part as object)?.constructor?.name}`);
							}
						}
						// Close any open thinking block at end of stream
						if (thinkingActive) {
							thinkingStream?.thinkingProgress({ id: '', text: '', metadata: { vscodeReasoningDone: true, stopReason: 'other' } });
						}
					} catch (streamErr) {
						console.error(`[FlowParticipant] Stream error in round ${toolRound + 1}:`, streamErr);
						stream.markdown(`\n> ❌ **Stream error (${role.name})**: ${String(streamErr)}\n\n`);
					}
					return { text, calls };
				};
				
				// Call the model
				const label = `Round ${toolRound + 1}: ${messages.length} msg(s) → ${model.name}`;
				console.log(`[FlowParticipant] ${label}`);
				// Log actual message content to diagnose empty responses
				for (let mi = 0; mi < messages.length; mi++) {
					const msg = messages[mi];
					const roleStr = msg.role === vscode.LanguageModelChatMessageRole.User ? 'User' : 'Assistant';
					const textContent = (Array.isArray(msg.content) ? msg.content : [])
						.filter((p: unknown) => p instanceof vscode.LanguageModelTextPart)
						.map((p: unknown) => (p as vscode.LanguageModelTextPart).value)
						.join('')
						.substring(0, 200);
					console.log(`[FlowParticipant] msg[${mi}] ${roleStr}: "${textContent}"`);
				}
				stream.progress(label);
				
				const chatRequest = await model.sendRequest(messages, options, token);
				const { text: initialText, calls: toolCalls } = await streamParts(chatRequest);
				let roundText = initialText;
				
				// Fallback: if model returned nothing with tools, retry without tools.
				// The Copilot backend silently returns an empty stream for invalid/rejected tool schemas.
				if (roundText === '' && toolCalls.length === 0 && options.tools && options.tools.length > 0) {
					console.warn(`[FlowParticipant] Empty response with tools — retrying without tools`);
					stream.progress('Tools caused empty response — retrying without tools…');
					const retryRequest = await model.sendRequest(messages, {}, token);
					const retry = await streamParts(retryRequest);
					roundText = retry.text;
					toolCalls.push(...retry.calls);
					if (roundText || toolCalls.length) {
						console.log('[FlowParticipant] Retry without tools succeeded');
					} else {
						console.error('[FlowParticipant] Retry without tools also returned empty');
					}
				}
				
				// Accumulate text response
				responseText += roundText;
				
				console.log(`[FlowParticipant] Round ${toolRound + 1}: roundText="${roundText}", toolCalls=${toolCalls.length}, accumulated responseText length=${responseText.length}`);
				
				// If no tool calls, we're done
				if (toolCalls.length === 0) {
					console.log(`[FlowParticipant] No tool calls in round ${toolRound + 1}, exiting loop`);
					break;
				}

				// Add to tool call rounds
				toolCallRounds.push({
					response: roundText,
					toolCalls
				});

				// Pre-execute file-writing tool calls with edit tracking BEFORE the next
				// renderPrompt() run. Caching results here prevents ToolResultElement from
				// re-executing them without stream.externalEdit() tracking.
				type ExternalEditStream = { externalEdit: (uris: vscode.Uri[], cb: () => Promise<void>) => Promise<string> };
				const extStream = (stream as unknown as ExternalEditStream);
				const hasExternalEdit = typeof extStream.externalEdit === 'function';
				for (const tc of toolCalls) {
					if (toolCallResults[tc.callId]) {
						continue; // Already cached from a prior round
					}
					if (tc.name === 'copilot_createFile' || tc.name === 'create_file') {
						const input = tc.input as { filePath?: string; content?: string };
						if (!input.filePath || input.content === undefined) {
							toolCallResults[tc.callId] = { content: [new vscode.LanguageModelTextPart('Error: Missing filePath or content')] };
							continue;
						}
						const fileUri = vscode.Uri.file(input.filePath);
						try {
							if (hasExternalEdit) {
								await extStream.externalEdit([fileUri], async () => {
									await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(input.content!));
								});
							} else {
								await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(input.content!));
							}
							toolCallResults[tc.callId] = { content: [new vscode.LanguageModelTextPart(`File created successfully: ${input.filePath}`)] };
							console.log(`[FlowParticipant] File created with edit tracking: ${input.filePath}`);
						} catch (err) {
							toolCallResults[tc.callId] = { content: [new vscode.LanguageModelTextPart(`File creation error: ${err instanceof Error ? err.message : String(err)}`)] };
						}
					}
				}

				console.log(`[FlowParticipant] Tool round ${toolRound + 1} complete. Continuing to round ${toolRound + 2}...`);
				
				// Report progress for next round
				stream.progress(`Processing tool results (round ${toolRound + 1}/${maxToolRounds})...`);
				
				toolRound++;
			}
			
			if (toolRound >= maxToolRounds) {
				console.warn(`[FlowParticipant] Role ${role.name} hit max tool rounds (${maxToolRounds}). May not have completed successfully.`);
				stream.markdown(`\n> ⚠️ **${role.name}**: reached max tool rounds (${maxToolRounds}) without generating a text response.\n\n`);
			}
			
			const finalContent = responseText.trim();
			if (!finalContent) {
				const toolRoundSummary = toolCallRounds.length > 0
					? ` after ${toolCallRounds.length} tool-call round(s)`
					: '';
				console.warn(`[FlowParticipant] Role ${role.name} completed${toolRoundSummary} but returned empty content`);
				// Surface a diagnostic to the user so they can see what happened
				stream.markdown(`\n> ⚠️ **${role.name}** returned an empty response${toolRoundSummary}. Model: ${model.name} (maxInputTokens=${model.maxInputTokens})\n\n`);
			} else {
				console.log(`[FlowParticipant] Role ${role.name} completed with ${finalContent.length} characters after ${toolRound} tool round(s)`);
			}
			
			return {
				roleName: role.name,
				content: finalContent,
				model: model.name
			};
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : '';
			console.error(`[FlowParticipant] Error in callRole for ${role.name}:`, errorMessage, errorStack);
			return {
				roleName: role.name,
				content: '',
				model: role.model || 'unknown',
				error: errorMessage
			};
		}
	}

	/**
	 * Execute a stage-based flow: stages run sequentially, each stage loops for up to
	 * `stage.iterations` rounds. The loop exits early when the last role in the sub-flow
	 * emits the convergence sentinel `<!-- flow:done -->`.
	 */
	private async executeStages(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		conversation: FlowConversation,
		currentTurn: FlowTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
		currentChatModel: vscode.LanguageModelChat
	): Promise<void> {
		const { tools, missingTools } = this.getFlowTools(config);
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: Tools not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
		}

		// Running context accumulates across stages so later stages see earlier stages' output
		let runningContext = userQuery;

		for (const stage of config.stages!) {
			if (token.isCancellationRequested) {
				return;
			}

			stream.markdown(`## Stage: ${stage.name}\n`);
			if (stage.subFlow !== 'sequence') {
				stream.markdown(`*Sub-flow: \`${stage.subFlow}\` · up to ${stage.iterations} iteration(s)*\n\n`);
			} else if (stage.iterations > 1) {
				stream.markdown(`*Up to ${stage.iterations} iteration(s)*\n\n`);
			} else {
				stream.markdown('\n');
			}

			const maxIter = stage.iterations;
			// Merge flow-level + stage-level skills; role-level skills are merged inside the loop
			const inheritedSkillRefs = [...(config.skills ?? []), ...(stage.skills ?? [])];
			const inheritedContextRefs = [...(config.contexts ?? []), ...(stage.contexts ?? [])];

			for (let iter = 0; iter < maxIter; iter++) {
				if (token.isCancellationRequested) {
					return;
				}

				if (maxIter > 1) {
					stream.markdown(`### Iteration ${iter + 1} of ${maxIter}\n\n`);
				}

				let lastResponse = '';

				for (const role of stage.roles) {
					if (token.isCancellationRequested) {
						return;
					}

					// Output header before calling the model so streamed text appears under it.
					stream.markdown(`#### ${role.name}\n\n`);
					stream.progress(`[${stage.name}] ${role.name} is thinking...`);

				const roleSkillRefs = [...inheritedSkillRefs, ...(role.skills ?? [])];
					const roleContextRefs = [...inheritedContextRefs, ...(role.contexts ?? [])];
					const augmentedSystemPrompt = await this.buildAugmentedSystemPrompt(
						role,
						roleSkillRefs,
						config.promptUri,
						runningContext,
						token
					);
					const flowDocContextFiles = await this.resolveContextFiles(roleContextRefs, config.promptUri, token);
					const refContextFiles = await this.resolveReferenceFiles(vsCodeContext.references, config.promptUri, token);
					const contextFiles = [...refContextFiles, ...flowDocContextFiles];
					const augmentedRole = { name: role.name, prompt: augmentedSystemPrompt, model: role.model };

					const response = await this.callRole(
						augmentedRole,
						runningContext,
						vsCodeContext,
						config.sharedContext,
						contextFiles,
						conversation.getHistory().slice(0, -1),
						tools,
						stream,
						token,
						toolInvocationToken,
						currentChatModel
					);

					lastResponse = response.content;
					currentTurn.responses.set(`${stage.name}:${role.name}:iter${iter + 1}`, response.content);

					// Content was already streamed live inside callRole().
					if (response.error) {
						stream.markdown(`*Error: ${response.error}*\n\n`);
					} else {
						stream.markdown('\n\n');
					}
					if (response.model) {
						stream.markdown(`*<sub>Model: ${response.model}</sub>*\n\n`);
					}
					stream.markdown('---\n\n');

					// Append this role's output so subsequent roles in the sub-flow see prior work
					runningContext = `${runningContext}\n\n**[${stage.name} / ${role.name}]**:\n${response.content}`;
				}

				// Check convergence sentinel in last role's response.
				// Early exit only when `doneWord` is configured; without it the stage
				// always runs for the full `iterations` count.
				if (stage.doneWord && lastResponse.includes(stage.doneWord)) {
					if (maxIter > 1) {
						stream.markdown(`*Stage converged after iteration ${iter + 1}.*\n\n`);
					}
					break;
				}
			}
		}
	}

	/**
	 * Build the effective system prompt for a role by:
	 *   1. Resolving an optional agent file (body becomes the base prompt)
	 *   2. Prepending an optional inline prompt
	 *   3. Injecting resolved skill content under "## Applicable Skills"
	 *   4. Substituting `$ARGUMENTS` with the active user query in ALL loaded content
	 *
	 * Context files are intentionally excluded here — they are passed directly to the
	 * prompt-tsx renderer as lower-priority elements so the token-budget system can
	 * drop them gracefully when needed.
	 *
	 * `$ARGUMENTS` is replaced with `role.args` when set, otherwise `userQuery`.
	 */
	private async buildAugmentedSystemPrompt(
		role: { prompt?: string; agent?: IAgentRef; args?: string },
		skillRefs: ReadonlyArray<ISkillRef>,
		flowUri: vscode.Uri,
		userQuery: string,
		token: vscode.CancellationToken
	): Promise<string> {
		const effectiveArgs = role.args ?? userQuery;

		// 1. Resolve agent file → base system prompt
		let basePrompt = role.prompt ?? '';
		if (role.agent) {
			const agentContent = await this.resolveAgentContent(role.agent, flowUri, token);
			if (agentContent) {
				const substituted = agentContent.replace(/\$ARGUMENTS/g, effectiveArgs);
				// If there is also an inline prompt, prepend it as additional context
				basePrompt = basePrompt
					? `${basePrompt}\n\n---\n## Agent Instructions\n\n${substituted}`
					: substituted;
			}
		}

		// Fallback if neither prompt nor agent resolved to content
		if (!basePrompt) {
			basePrompt = 'You are a helpful assistant.';
		}

		// 2. Resolve and inject skills
		if (skillRefs.length === 0) {
			return basePrompt;
		}
		const contents: string[] = [];
		for (const ref of skillRefs) {
			const content = await this.resolveSkillContent(ref, flowUri, token);
			if (content) {
				// Substitute $ARGUMENTS in skill content too
				contents.push(content.replace(/\$ARGUMENTS/g, effectiveArgs));
			}
		}
		if (contents.length === 0) {
			return basePrompt;
		}
		return `${basePrompt}\n\n---\n## Applicable Skills\n\n${contents.join('\n\n---\n\n')}`;
	}

	/**
	 * Convert VS Code `ChatPromptReference[]` (the `#file:` attachments the user added in
	 * the chat input) into `ContextFile[]` for the prompt-tsx renderer.
	 *
	 * Only file/location references whose content can be read are included.
	 * The `flowFileUri` is excluded because it is already being used as the flow config.
	 */
	private async resolveReferenceFiles(
		refs: readonly vscode.ChatPromptReference[],
		flowFileUri: vscode.Uri,
		token: vscode.CancellationToken
	): Promise<ContextFile[]> {
		const results: ContextFile[] = [];
		for (const ref of refs) {
			if (token.isCancellationRequested) { break; }

			// Extract the URI — value can be Uri, Location, or something else
			let uri: vscode.Uri | undefined;
			const v = ref.value as unknown;
			if (v instanceof vscode.Uri) {
				uri = v;
			} else if (v && typeof v === 'object' && 'uri' in v && (v as { uri: unknown }).uri instanceof vscode.Uri) {
				uri = (v as { uri: vscode.Uri }).uri;
			}

			if (!uri) { continue; }

			// Skip the flow file itself — already used as config
			if (uri.toString() === flowFileUri.toString()) { continue; }

			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const content = Buffer.from(bytes).toString('utf8');
				const label = vscode.workspace.asRelativePath(uri, false);
				results.push({ label, content });
			} catch {
				// File unreadable (binary, permission denied, etc.) — skip silently
			}
		}
		return results;
	}

	/**
	 * Resolve context file references to `ContextFile` objects for the prompt-tsx renderer.
	 * Files are read verbatim (no frontmatter stripping) and labelled with their path.
	 *
	 * Resolution order for bare string paths:
	 *   1. Relative to the flow file's directory
	 *   2. Relative to the first workspace folder root
	 */
	private async resolveContextFiles(
		refs: ReadonlyArray<IContextRef>,
		flowUri: vscode.Uri,
		token: vscode.CancellationToken
	): Promise<ContextFile[]> {
		if (refs.length === 0) { return []; }
		const results: ContextFile[] = [];
		for (const ref of refs) {
			if (token.isCancellationRequested) { break; }
			const content = await this.resolveContextContent(ref, flowUri, token);
			if (content !== undefined) {
				const label = typeof ref === 'string' ? ref : ref.path;
				results.push({ label, content });
			}
		}
		return results;
	}

	/**
	 * Resolve a context file reference to its full text content.
	 * Resolution order for bare strings:
	 *   1. Path relative to the flow file's directory
	 *   2. Path relative to the first workspace folder root
	 *
	 * For `{ path }` objects: always resolved relative to the flow file.
	 */
	private async resolveContextContent(
		ref: IContextRef,
		flowUri: vscode.Uri,
		_token: vscode.CancellationToken
	): Promise<string | undefined> {
		try {
			const p = typeof ref === 'string' ? ref : ref.path;
			const flowDir = vscode.Uri.joinPath(flowUri, '..');

			const candidates: vscode.Uri[] = [
				vscode.Uri.joinPath(flowDir, p),
			];
			const wsFolder = vscode.workspace.workspaceFolders?.[0];
			if (wsFolder) {
				candidates.push(vscode.Uri.joinPath(wsFolder.uri, p));
			}

			for (const candidate of candidates) {
				try {
					await vscode.workspace.fs.stat(candidate);
					const bytes = await vscode.workspace.fs.readFile(candidate);
					const text = Buffer.from(bytes).toString('utf8');
					console.log(`[FlowParticipant] Resolved context: ${candidate.fsPath}`);
					return text.trim();
				} catch {
					// not found at this candidate
				}
			}
			console.warn(`[FlowParticipant] Context file not found: ${p}`);
			return undefined;
		} catch (error) {
			console.warn(`[FlowParticipant] Failed to resolve context: ${error}`);
			return undefined;
		}
	}

	/**
	 * Resolve an agent reference to its body text (YAML frontmatter stripped).
	 *
	 * Resolution order for bare names:
	 *   1. .github/agents/{name}.agent.md  (Spec Kit / Copilot convention)
	 *   2. .agents/{name}.agent.md         (alternative convention)
	 *   3. .github/agents/{name}           (without .agent.md suffix, for flexibility)
	 *
	 * For `{ path }` refs: resolved relative to the flow file.
	 */
	private async resolveAgentContent(
		ref: IAgentRef,
		flowUri: vscode.Uri,
		_token: vscode.CancellationToken
	): Promise<string | undefined> {
		try {
			let agentUri: vscode.Uri | undefined;

			if (typeof ref === 'string') {
				const name = ref.trim();
				const wsFolder = vscode.workspace.workspaceFolders?.[0];
				if (wsFolder) {
					// Candidate paths in priority order
					const candidates = [
						vscode.Uri.joinPath(wsFolder.uri, '.github', 'agents', `${name}.agent.md`),
						vscode.Uri.joinPath(wsFolder.uri, '.agents', `${name}.agent.md`),
						vscode.Uri.joinPath(wsFolder.uri, '.github', 'agents', name),
					];
					for (const candidate of candidates) {
						try {
							await vscode.workspace.fs.stat(candidate);
							agentUri = candidate;
							break;
						} catch {
							// not found at this path
						}
					}
				}
			} else {
				// Explicit path relative to the flow file
				agentUri = vscode.Uri.joinPath(vscode.Uri.joinPath(flowUri, '..'), ref.path);
			}

			if (!agentUri) {
				console.warn(`[FlowParticipant] Agent not found: ${typeof ref === 'string' ? ref : ref.path}`);
				return undefined;
			}

			console.log(`[FlowParticipant] Resolved agent: ${agentUri.fsPath}`);
			const bytes = await vscode.workspace.fs.readFile(agentUri);
			const text = Buffer.from(bytes).toString('utf8');
			// Strip YAML frontmatter — return body only
			const parts = text.split(/^---\s*$/m);
			return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
		} catch (error) {
			console.warn(`[FlowParticipant] Failed to resolve agent: ${error}`);
			return undefined;
		}
	}

	/**
	 * Resolve a skill reference to its body text (frontmatter stripped).
	 *
	 * Resolution order for bare names:
	 *   1. vscode.chat.getSkills() platform API (all sources)
	 *   2. .agents/skills/{name}/SKILL.md relative to workspace root
	 *   3. .github/skills/{name}/SKILL.md relative to workspace root
	 *
	 * For `{ path }` refs: resolved relative to the flow file.
	 */
	private async resolveSkillContent(
		ref: ISkillRef,
		flowUri: vscode.Uri,
		token: vscode.CancellationToken
	): Promise<string | undefined> {
		try {
			let skillUri: vscode.Uri | undefined;

			if (typeof ref === 'string') {
				// 1. Try platform API
				const getSkills = (vscode.chat as { getSkills?: (t: vscode.CancellationToken) => Thenable<readonly { name: string; uri: vscode.Uri }[]> }).getSkills;
				if (typeof getSkills === 'function') {
					const platformSkills = await getSkills.call(vscode.chat, token);
					const match = platformSkills.find(s => s.name.toLowerCase() === ref.toLowerCase());
					if (match) {
						skillUri = match.uri;
					}
				}
				// 2. Workspace search paths
				if (!skillUri) {
					const wsFolder = vscode.workspace.workspaceFolders?.[0];
					if (wsFolder) {
						for (const searchPath of ['.agents/skills', '.github/skills']) {
							const candidate = vscode.Uri.joinPath(wsFolder.uri, searchPath, ref, 'SKILL.md');
							try {
								await vscode.workspace.fs.stat(candidate);
								skillUri = candidate;
								break;
							} catch {
								// not found at this path
							}
						}
					}
				}
			} else {
				// Explicit path relative to the flow file
				skillUri = vscode.Uri.joinPath(vscode.Uri.joinPath(flowUri, '..'), ref.path);
			}

			if (!skillUri) {
				console.warn(`[FlowParticipant] Skill not found: ${typeof ref === 'string' ? ref : ref.path}`);
				return undefined;
			}

			const bytes = await vscode.workspace.fs.readFile(skillUri);
			const text = Buffer.from(bytes).toString('utf8');
			// Strip YAML frontmatter — return body only
			const parts = text.split(/^---\s*$/m);
			return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
		} catch (error) {
			console.warn(`[FlowParticipant] Failed to resolve skill: ${error}`);
			return undefined;
		}
	}
}
