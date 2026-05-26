/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFlowConfig, ISkillRef, IAgentRef, IContextRef, IPromptRef, IRoleResponse, FlowService } from './flowService';
import { FlowContextBuilder, IFlowContext } from '../context/flowContextBuilder';
import { FlowTurn, FlowConversationStore } from '../session/flowConversation';
import { ContextFile, FlowPromptRenderer } from '../prompts/flowPromptRenderer';
import { ToolCallRound } from '../prompts/flowTools';
import { normalizeToolSchemas } from '../util/toolSchemaNormalizer';
import { filterTools, shouldFilterTools } from '../util/toolFilter';
import { CopilotSdkExecutor } from '../util/copilotSdkExecutor';
import { ILogger } from '../platform/log/common/logService';

/**
 * Flow execution engine - handles all execution strategies and prompt resolution.
 * Separated from FlowParticipant to keep participant logic focused on request routing.
 */
export class FlowEngine {
	private readonly promptRenderer: FlowPromptRenderer;
	private readonly sdkExecutor: CopilotSdkExecutor;
	private readonly flowService: FlowService;
	private readonly contextBuilder: FlowContextBuilder;
	private readonly conversationStore: FlowConversationStore;
	private readonly log: ILogger;

	/** Stable session ID reused while the same VS Code chat conversation is active. */
	private currentSessionId: string | undefined;

	constructor(log: ILogger) {
		this.log = log;
		this.promptRenderer = new FlowPromptRenderer(log.createSubLogger('Renderer'));
		this.sdkExecutor = new CopilotSdkExecutor(log.createSubLogger('SdkExecutor'));
		this.flowService = new FlowService();
		this.contextBuilder = new FlowContextBuilder();
		this.conversationStore = new FlowConversationStore();
	}

	/**
	 * Parse, validate, and execute a flow from a URI.
	 * Owns context building, conversation management, and orchestration dispatch.
	 */
	async execute(
		flowFileUri: vscode.Uri,
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<vscode.ChatResult> {
		// Parse the flow configuration
		stream.progress('Parsing flow configuration...');
		const config = await this.flowService.parsePrompt(flowFileUri);

		if (!config) {
			stream.markdown('❌ **Error**: Failed to parse flow file. Please check the format.');
			return { errorDetails: { message: 'Invalid flow file format' } };
		}

		// Validate configuration
		const validation = this.flowService.validate(config);
		if (!validation.valid) {
			stream.markdown('❌ **Validation Errors**:\n\n');
			for (const error of validation.errors) {
				stream.markdown(`- ${error}\n`);
			}
			return { errorDetails: { message: 'Invalid flow configuration' } };
		}

		// Show what we're doing
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

		if (config.orchestration === 'cli') {
			if (config.isolation) { stream.markdown(`**Isolation**: ${config.isolation}\n\n`); }
			if (config.cliMode) { stream.markdown(`**CLI Mode**: ${config.cliMode}\n\n`); }
			if (config.model) { stream.markdown(`**Model**: ${config.model}\n\n`); }
			if (config.customAgent) { stream.markdown(`**Agent**: ${config.customAgent}\n\n`); }
		}
		if (config.tools && config.tools.length > 0) {
			stream.markdown(`**Tools**: ${config.tools.join(', ')}\n\n`);
		}
		stream.markdown('---\n\n');

		// Build rich context and manage conversation
		const vsCodeContext = this.contextBuilder.buildContext(request);
		if (context.history.length === 0) {
			this.currentSessionId = 'session-' + Date.now();
		}
		const sessionId = this.currentSessionId ?? 'session-default';
		const conversation = this.conversationStore.getOrCreate(sessionId);
		const currentTurn = conversation.addTurn(request.prompt, vsCodeContext);

		if (token.isCancellationRequested) {
			return {};
		}

		const history = conversation.getHistory().slice(0, -1);

		switch (config.orchestration) {
			case 'sequence':
				if (config.stages) {
					const responses = await this.executeStages(
						config, request.prompt, vsCodeContext, history, stream, token,
						request.toolInvocationToken, request.model
					);
					for (const [key, content] of responses) {
						currentTurn.responses.set(key, content);
					}
				} else {
					const responses = await this.executeSequential(
						config, request.prompt, vsCodeContext, history, stream, token,
						request.toolInvocationToken, request.model
					);
					for (const [roleName, content] of responses) {
						currentTurn.responses.set(roleName, content);
					}
				}
				break;
			case 'cli': {
				const responses = await this.executeCli(
					config, request.prompt, vsCodeContext, history, stream, token
				);
				for (const [roleName, content] of responses) {
					currentTurn.responses.set(roleName, content);
				}
				break;
			}
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
	}

	/**
	 * Sequential orchestration: roles respond one after another
	 */
	async executeSequential(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		history: FlowTurn[],
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
		currentChatModel: vscode.LanguageModelChat
	): Promise<Map<string, string>> {
		const responses = new Map<string, string>();
		const { tools, missingTools } = this.getFlowTools(config);
		
		// Warn user about missing tools
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: The following tools are not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
			stream.markdown(`💡 **Tip**: Run the command "AI Flow: List Available Tools" to see registered tools.\n\n`);
		}
		
		for (const role of config.roles) {
			if (token.isCancellationRequested) {
				return responses;
			}

			const roleSkillRefs = [...(config.skills ?? []), ...(role.skills ?? [])];
			const roleContextRefs = [...(config.contexts ?? []), ...(role.contexts ?? [])];
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

			stream.markdown(`### ${role.name}\n\n`);
			stream.progress(`${role.name} is thinking...`);
			
			const response = await this.callRole(
				augmentedRole, 
				userQuery, 
				vsCodeContext, 
				config.sharedContext,
				contextFiles,
				history,
				tools,
				stream,
				token,
				toolInvocationToken,
				currentChatModel
			);
			
			responses.set(role.name, response.content);
			
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

		return responses;
	}

	/**
	 * Stage-based orchestration: stages run sequentially, each stage loops for iterations
	 */
	async executeStages(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		history: FlowTurn[],
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
		currentChatModel: vscode.LanguageModelChat
	): Promise<Map<string, string>> {
		const responses = new Map<string, string>();
		const { tools, missingTools } = this.getFlowTools(config);
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: Tools not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
		}

		let runningContext = userQuery;

		for (const stage of config.stages!) {
			if (token.isCancellationRequested) {
				return responses;
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
			const inheritedSkillRefs = [...(config.skills ?? []), ...(stage.skills ?? [])];
			const inheritedContextRefs = [...(config.contexts ?? []), ...(stage.contexts ?? [])];

			for (let iter = 0; iter < maxIter; iter++) {
				if (token.isCancellationRequested) {
					return responses;
				}

				if (maxIter > 1) {
					stream.markdown(`### Iteration ${iter + 1} of ${maxIter}\n\n`);
				}

					let lastResponse = '';
				// Files touched by tool calls across all roles in this stage/iteration,
				// injected as context for every subsequent role.
				const stagedTouchedFiles: vscode.Uri[] = [];

				for (const role of stage.roles) {
					if (token.isCancellationRequested) {
						return responses;
					}

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
					// Re-read files that earlier roles in this stage touched so subsequent roles
					// (e.g. a reviewer) see the actual current content, not just a text summary.
					const touchedContextFiles = await this.resolveTouchedFiles(stagedTouchedFiles, token);
					const contextFiles = [...refContextFiles, ...touchedContextFiles, ...flowDocContextFiles];
					const augmentedRole = { name: role.name, prompt: augmentedSystemPrompt, model: role.model };

					const response = await this.callRole(
						augmentedRole,
						runningContext,
						vsCodeContext,
						config.sharedContext,
						contextFiles,
						history,
						tools,
						stream,
						token,
						toolInvocationToken,
						currentChatModel
					);

					lastResponse = response.content;
					responses.set(`${stage.name}:${role.name}:iter${iter + 1}`, response.content);

					// Accumulate touched files so the next role in this stage can read them.
					if (response.touchedFiles) {
						for (const uri of response.touchedFiles) {
							if (!stagedTouchedFiles.some(u => u.toString() === uri.toString())) {
								stagedTouchedFiles.push(uri);
							}
						}
					}

					if (response.error) {
						stream.markdown(`*Error: ${response.error}*\n\n`);
					} else {
						stream.markdown('\n\n');
					}
					if (response.model) {
						stream.markdown(`*<sub>Model: ${response.model}</sub>*\n\n`);
					}
					stream.markdown('---\n\n');

					runningContext = `${runningContext}\n\n**[${stage.name} / ${role.name}]**:\n${response.content}`;
				}

				if (stage.doneWord && lastResponse.includes(stage.doneWord)) {
					if (maxIter > 1) {
						stream.markdown(`*Stage converged after iteration ${iter + 1}.*\n\n`);
					}
					break;
				}
			}
		}

		return responses;
	}

	/**
	 * CLI orchestration: SDK/CLI delegation with background agent support
	 */
	async executeCli(
		config: IFlowConfig,
		userQuery: string,
		vsCodeContext: IFlowContext,
		history: FlowTurn[],
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<Map<string, string>> {
		const responses = new Map<string, string>();
		
		stream.progress('Flow executing via GitHub Copilot SDK...');
		
		// Validate SDK availability
		const availability = await this.sdkExecutor.checkAvailability();
		if (!availability.available) {
			stream.markdown(`⚠️ **SDK Mode Error**: ${availability.error}\n\n`);
			stream.markdown(`💡 **Note**: CLI orchestration requires GitHub Copilot SDK. Please ensure:\n`);
			stream.markdown(`- GitHub CLI is installed and authenticated\n`);
			stream.markdown(`- GitHub Copilot subscription is active\n\n`);
			return responses;
		}
		
		const mode = config.cliMode || 'supervised';
		const isolation = config.isolation || 'workspace';
		stream.markdown(`✅ Using GitHub Copilot SDK (${mode} mode, ${isolation} isolation)\n\n`);
		
		// Resolve prompt references before passing to SDK
		const responsePromises = config.roles.map(async role => {
			const resolvedPrompt = role.prompt 
				? await this.resolvePromptContent(role.prompt, config.promptUri, token) ?? ''
				: '';
			return this.callRoleSdk(
				{ name: role.name, prompt: resolvedPrompt, model: role.model },
				userQuery, vsCodeContext, config.sharedContext, history, stream, token
			);
		});
		
		const roleResponses = await Promise.all(responsePromises);
		
		for (let i = 0; i < config.roles.length; i++) {
			if (token.isCancellationRequested) {
				return responses;
			}
			
			const role = config.roles[i];
			const response = roleResponses[i];
			
			responses.set(role.name, response.content);
			
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
		
		return responses;
	}

	// ------------------------------------------------------------------
	// Tool Management
	// ------------------------------------------------------------------

	/**
	 * Get tools array from flow config
	 */
	private getFlowTools(config: IFlowConfig): { tools: vscode.LanguageModelChatTool[] | undefined; missingTools: ReadonlyArray<string> } {
		if (!config.tools || config.tools.length === 0) {
			return { tools: undefined, missingTools: [] };
		}
		
		const allTools = vscode.lm.tools;
		if (!allTools) {
			this.log.warn('vscode.lm.tools is undefined');
			return { tools: undefined, missingTools: config.tools ?? [] };
		}
		
		if (config.tools.includes('*')) {
			this.log.debug(`Wildcard '*' detected - ${allTools.length} tools available`);
			return { tools: [...allTools], missingTools: [] };
		}
		
		const matchedTools = allTools.filter(tool => 
			config.tools?.includes(tool.name)
		);
		
		const unmatchedTools = config.tools.filter(name => 
			!allTools.some(tool => tool.name === name)
		);
		
		if (unmatchedTools.length > 0) {
			this.log.warn(`Tools not found: ${unmatchedTools.join(', ')}`);
		}
		
		return {
			tools: matchedTools.length > 0 ? matchedTools : undefined,
			missingTools: unmatchedTools
		};
	}

	// ------------------------------------------------------------------
	// Role Execution
	// ------------------------------------------------------------------

	/**
	 * Call a role using GitHub Copilot SDK
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
			this.log.error(error instanceof Error ? error : String(error), `Error in callRoleSdk for ${role.name}`);
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
				model = currentChatModel;
			}

			const rawMaxInput = model.maxInputTokens || 32768;
			const maxPromptTokens = rawMaxInput > 16384
				? rawMaxInput - 8192
				: Math.floor(rawMaxInput * 0.75);
			this.log.debug(`Model: ${model.name}, maxInputTokens=${model.maxInputTokens}, using maxPromptTokens=${maxPromptTokens}`);
			
			let responseText = '';
			const maxToolRounds = 15;
			let toolRound = 0;
			const toolCallRounds: ToolCallRound[] = [];
			let toolCallResults: Record<string, vscode.LanguageModelToolResult> = {};
			// Track files created/modified by tool calls so callers can inject them
			// as context into subsequent roles (e.g. reviewer sees the actual file).
			const touchedFileUris: vscode.Uri[] = [];
			
			while (toolRound < maxToolRounds) {
				if (token.isCancellationRequested) {
					break;
				}
				
				this.log.trace(`Starting tool round ${toolRound + 1} of ${maxToolRounds} for role ${role.name}`);

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
				
				this.log.debug(`Prompt rendered: ${renderResult.messages.length} messages`);
				
				toolCallResults = { ...toolCallResults, ...renderResult.toolCallResults };
				
				const messages = renderResult.messages;
				
				if (messages.length === 0) {
					this.log.error(`renderPrompt returned 0 messages for ${role.name} — aborting`);
					return { roleName: role.name, content: '', model: model.name, error: 'No prompt messages generated' };
				}

				const runtimeCaps = (model as unknown as { capabilities?: { toolCalling?: boolean | number } }).capabilities;
				const modelSupportsTools = runtimeCaps ? runtimeCaps.toolCalling !== false : true;
				if (!modelSupportsTools) {
					this.log.warn(`Model ${model.name} reports toolCalling=false — skipping tools`);
				}

				const options: vscode.LanguageModelChatRequestOptions = {};
				if (tools && tools.length > 0 && modelSupportsTools) {
					let filteredTools = tools;
					if (shouldFilterTools(tools.length)) {
						this.log.debug(`Applying smart tool filtering (${tools.length} -> max 128)`);
						filteredTools = filterTools(tools, userQuery, undefined, this.log);
					}
					
					const normalizedTools = normalizeToolSchemas(filteredTools);
					options.tools = normalizedTools;
					this.log.debug(`Using ${normalizedTools.length} tools`);
				}
				
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
								if (thinkingActive) {
									thinkingStream?.thinkingProgress({ id: '', text: '', metadata: { vscodeReasoningDone: true, stopReason: 'text' } });
									thinkingActive = false;
								}
								text += part.value;
								stream.markdown(part.value);
							} else if (part instanceof vscode.LanguageModelToolCallPart) {
								calls.push(part);
								stream.progress(`🔧 ${part.name}(...)`);
								this.log.trace(`Received tool call: ${part.name} (callId: ${part.callId})`);
							} else if (part instanceof vscode.LanguageModelDataPart) {
								if (part.mimeType.startsWith('text/')) {
									try {
										const decoded = new TextDecoder().decode(part.data);
										text += decoded;
										stream.markdown(decoded);
									} catch { /* ignore */ }
								}
							} else if (ThinkingPartCtor && part instanceof ThinkingPartCtor) {
								const thinkPart = part as { value: string | string[]; id?: string; metadata?: Record<string, unknown> };
								const thinkText = Array.isArray(thinkPart.value) ? thinkPart.value.join('') : (thinkPart.value ?? '');
								if (thinkingStream) {
									thinkingStream.thinkingProgress({ text: thinkText, id: thinkPart.id, metadata: thinkPart.metadata });
									thinkingActive = true;
								} else if (thinkText) {
									stream.markdown(`> 💭 ${thinkText}\n`);
								}
							} else if ((part as object)?.constructor?.name === 'LanguageModelThinkingPart') {
								const thinkPart = part as { value: string | string[]; id?: string; metadata?: Record<string, unknown> };
								const thinkText = Array.isArray(thinkPart.value) ? thinkPart.value.join('') : (thinkPart.value ?? '');
								if (thinkingStream) {
									thinkingStream.thinkingProgress({ text: thinkText, id: thinkPart.id, metadata: thinkPart.metadata });
									thinkingActive = true;
								} else if (thinkText) {
									stream.markdown(`> 💭 ${thinkText}\n`);
								}
							}
						}
						if (thinkingActive) {
							thinkingStream?.thinkingProgress({ id: '', text: '', metadata: { vscodeReasoningDone: true, stopReason: 'other' } });
						}
					} catch (streamErr) {
						this.log.error(streamErr instanceof Error ? streamErr : String(streamErr), `Stream error in round ${toolRound + 1}`);
						stream.markdown(`\n> ❌ **Stream error (${role.name})**: ${String(streamErr)}\n\n`);
					}
					return { text, calls };
				};
				
				const label = `Round ${toolRound + 1}: ${messages.length} msg(s) → ${model.name}`;
				this.log.trace(label);
				stream.progress(label);
				
				const chatRequest = await model.sendRequest(messages, options, token);
				const { text: initialText, calls: toolCalls } = await streamParts(chatRequest);
				let roundText = initialText;
				
				if (roundText === '' && toolCalls.length === 0 && options.tools && options.tools.length > 0) {
					this.log.warn('Empty response with tools — retrying without tools');
					stream.progress('Tools caused empty response — retrying without tools…');
					const retryRequest = await model.sendRequest(messages, {}, token);
					const retry = await streamParts(retryRequest);
					roundText = retry.text;
					toolCalls.push(...retry.calls);
				}
				
				responseText += roundText;
				
				this.log.trace(`Round ${toolRound + 1}: roundText length=${roundText.length}, toolCalls=${toolCalls.length}`);
				
				if (toolCalls.length === 0) {
					this.log.trace(`No tool calls in round ${toolRound + 1}, exiting loop`);
					break;
				}

				toolCallRounds.push({
					response: roundText,
					toolCalls
				});

				type ExternalEditStream = { externalEdit: (uris: vscode.Uri[], cb: () => Promise<void>) => Promise<string> };
				const extStream = (stream as unknown as ExternalEditStream);
				const hasExternalEdit = typeof extStream.externalEdit === 'function';
				for (const tc of toolCalls) {
					if (toolCallResults[tc.callId]) {
						continue;
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
							touchedFileUris.push(fileUri);
							this.log.debug(`File created: ${input.filePath}`);
						} catch (err) {
							toolCallResults[tc.callId] = { content: [new vscode.LanguageModelTextPart(`File creation error: ${err instanceof Error ? err.message : String(err)}`)] };
						}
					}
				}

				stream.progress(`Processing tool results (round ${toolRound + 1}/${maxToolRounds})...`);
				
				toolRound++;
			}
			
			if (toolRound >= maxToolRounds) {
				this.log.warn(`Role ${role.name} hit max tool rounds (${maxToolRounds})`);
				stream.markdown(`\n> ⚠️ **${role.name}**: reached max tool rounds (${maxToolRounds})\n\n`);
			}
			
			const finalContent = responseText.trim();
			if (!finalContent) {
				this.log.warn(`Role ${role.name} returned empty content`);
				stream.markdown(`\n> ⚠️ **${role.name}** returned an empty response. Model: ${model.name}\n\n`);
			}

			return {
				roleName: role.name,
				content: finalContent,
				model: model.name,
				touchedFiles: touchedFileUris.length > 0 ? touchedFileUris : undefined
			};
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.log.error(error instanceof Error ? error : errorMessage, `Error in callRole for ${role.name}`);
			return {
				roleName: role.name,
				content: '',
				model: role.model || 'unknown',
				error: errorMessage
			};
		}
	}

	// ------------------------------------------------------------------
	// Prompt Resolution
	// ------------------------------------------------------------------

	/**
	 * Build the effective system prompt for a role
	 */
	private async buildAugmentedSystemPrompt(
		role: { prompt?: IPromptRef; agent?: IAgentRef; args?: string },
		skillRefs: ReadonlyArray<ISkillRef>,
		flowUri: vscode.Uri,
		userQuery: string,
		token: vscode.CancellationToken
	): Promise<string> {
		const effectiveArgs = role.args ?? userQuery;

		let basePrompt = '';
		if (role.prompt) {
			basePrompt = await this.resolvePromptContent(role.prompt, flowUri, token) ?? '';
		}

		if (role.agent) {
			const agentContent = await this.resolveAgentContent(role.agent, flowUri, token);
			if (agentContent) {
				const substituted = agentContent.replace(/\$ARGUMENTS/g, effectiveArgs);
				basePrompt = basePrompt
					? `${basePrompt}\n\n---\n## Agent Instructions\n\n${substituted}`
					: substituted;
			}
		}

		if (!basePrompt) {
			basePrompt = 'You are a helpful assistant.';
		}

		if (skillRefs.length === 0) {
			return basePrompt;
		}
		const contents: string[] = [];
		for (const ref of skillRefs) {
			const content = await this.resolveSkillContent(ref, flowUri, token);
			if (content) {
				contents.push(content.replace(/\$ARGUMENTS/g, effectiveArgs));
			}
		}
		if (contents.length === 0) {
			return basePrompt;
		}
		return `${basePrompt}\n\n---\n## Applicable Skills\n\n${contents.join('\n\n---\n\n')}`;
	}

	/**
	 * Resolve a prompt reference to its content
	 */
	async resolvePromptContent(
		ref: IPromptRef,
		flowUri: vscode.Uri,
		_token: vscode.CancellationToken
	): Promise<string | undefined> {
		try {
			if (typeof ref === 'string') {
				return ref.trim() || undefined;
			}

			if ('uri' in ref) {
				const uriStr = ref.uri.trim();
				let promptUri: vscode.Uri;
				if (uriStr.startsWith('file://')) {
					promptUri = vscode.Uri.parse(uriStr);
				} else if (uriStr.startsWith('/') || /^[A-Za-z]:/.test(uriStr)) {
					promptUri = vscode.Uri.file(uriStr);
				} else {
					promptUri = vscode.Uri.joinPath(vscode.Uri.joinPath(flowUri, '..'), uriStr);
				}
				const bytes = await vscode.workspace.fs.readFile(promptUri);
				const text = Buffer.from(bytes).toString('utf8');
				this.log.debug(`Resolved prompt from URI: ${promptUri.fsPath}`);
				const parts = text.split(/^---\s*$/m);
				return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
			}

			if ('name' in ref) {
				const name = ref.name.trim();
				const filename = name.endsWith('.prompt.md') ? name : `${name}.prompt.md`;
				const filenameAlt = name.endsWith('.prompt.md') ? name.replace('.prompt.md', '') : name;

				const wsFolder = vscode.workspace.workspaceFolders?.[0];
				const candidates: vscode.Uri[] = [];

				if (wsFolder) {
					candidates.push(
						vscode.Uri.joinPath(wsFolder.uri, '.github', 'prompts', filename),
						vscode.Uri.joinPath(wsFolder.uri, '.github', 'prompts', filenameAlt),
						vscode.Uri.joinPath(wsFolder.uri, '.vscode', 'prompts', filename),
						vscode.Uri.joinPath(wsFolder.uri, '.vscode', 'prompts', filenameAlt),
					);
				}

				const userHome = process.env.HOME || process.env.USERPROFILE;
				if (userHome) {
					candidates.push(
						vscode.Uri.joinPath(vscode.Uri.file(userHome), '.copilot', 'prompts', filename),
						vscode.Uri.joinPath(vscode.Uri.file(userHome), '.copilot', 'prompts', filenameAlt),
					);
				}

				for (const candidate of candidates) {
					try {
						await vscode.workspace.fs.stat(candidate);
						const bytes = await vscode.workspace.fs.readFile(candidate);
						const text = Buffer.from(bytes).toString('utf8');
						this.log.debug(`Resolved prompt from name: ${candidate.fsPath}`);
						const parts = text.split(/^---\s*$/m);
						return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
					} catch {
						// not found
					}
				}

				this.log.warn(`Prompt not found by name: ${name}`);
				return undefined;
			}

			return undefined;
		} catch (error) {
			this.log.warn(`Failed to resolve prompt: ${error}`);
			return undefined;
		}
	}

	/**
	 * Resolve context file references
	 */
	async resolveContextFiles(
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
	 * Resolve a context file reference to its content
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
					this.log.debug(`Resolved context: ${candidate.fsPath}`);
					return text.trim();
				} catch {
					// not found
				}
			}
			this.log.warn(`Context file not found: ${p}`);
			return undefined;
		} catch (error) {
			this.log.warn(`Failed to resolve context: ${error}`);
			return undefined;
		}
	}

	/**
	 * Read the current content of files that were touched by tool calls in a previous
	 * role. Deduplicates by URI. Skips unreadable files silently.
	 */
	private async resolveTouchedFiles(
		uris: readonly vscode.Uri[],
		token: vscode.CancellationToken
	): Promise<ContextFile[]> {
		const results: ContextFile[] = [];
		for (const uri of uris) {
			if (token.isCancellationRequested) { break; }
			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const content = Buffer.from(bytes).toString('utf8');
				const label = vscode.workspace.asRelativePath(uri, false);
				results.push({ label: `[changed] ${label}`, content });
			} catch {
				// file may have been deleted or is unreadable — skip
			}
		}
		return results;
	}

	/**
	 * Resolve reference files from chat attachments
	 */
	async resolveReferenceFiles(
		refs: readonly vscode.ChatPromptReference[],
		flowFileUri: vscode.Uri,
		token: vscode.CancellationToken
	): Promise<ContextFile[]> {
		const results: ContextFile[] = [];
		for (const ref of refs) {
			if (token.isCancellationRequested) { break; }

			let uri: vscode.Uri | undefined;
			const v = ref.value as unknown;
			if (v instanceof vscode.Uri) {
				uri = v;
			} else if (v && typeof v === 'object' && 'uri' in v && (v as { uri: unknown }).uri instanceof vscode.Uri) {
				uri = (v as { uri: vscode.Uri }).uri;
			}

			if (!uri) { continue; }
			if (uri.toString() === flowFileUri.toString()) { continue; }

			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				const content = Buffer.from(bytes).toString('utf8');
				const label = vscode.workspace.asRelativePath(uri, false);
				results.push({ label, content });
			} catch {
				// skip unreadable files
			}
		}
		return results;
	}

	/**
	 * Resolve an agent reference to its content
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
							// not found
						}
					}
				}
			} else {
				agentUri = vscode.Uri.joinPath(vscode.Uri.joinPath(flowUri, '..'), ref.path);
			}

			if (!agentUri) {
				this.log.warn(`Agent not found: ${typeof ref === 'string' ? ref : ref.path}`);
				return undefined;
			}

			this.log.debug(`Resolved agent: ${agentUri.fsPath}`);
			const bytes = await vscode.workspace.fs.readFile(agentUri);
			const text = Buffer.from(bytes).toString('utf8');
			const parts = text.split(/^---\s*$/m);
			return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
		} catch (error) {
			this.log.warn(`Failed to resolve agent: ${error}`);
			return undefined;
		}
	}

	/**
	 * Resolve a skill reference to its content
	 */
	private async resolveSkillContent(
		ref: ISkillRef,
		flowUri: vscode.Uri,
		token: vscode.CancellationToken
	): Promise<string | undefined> {
		try {
			let skillUri: vscode.Uri | undefined;

			if (typeof ref === 'string') {
				const getSkills = (vscode.chat as { getSkills?: (t: vscode.CancellationToken) => Thenable<readonly { name: string; uri: vscode.Uri }[]> }).getSkills;
				if (typeof getSkills === 'function') {
					const platformSkills = await getSkills.call(vscode.chat, token);
					const match = platformSkills.find(s => s.name.toLowerCase() === ref.toLowerCase());
					if (match) {
						skillUri = match.uri;
					}
				}
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
								// not found
							}
						}
					}
				}
			} else {
				skillUri = vscode.Uri.joinPath(vscode.Uri.joinPath(flowUri, '..'), ref.path);
			}

			if (!skillUri) {
				this.log.warn(`Skill not found: ${typeof ref === 'string' ? ref : ref.path}`);
				return undefined;
			}

			const bytes = await vscode.workspace.fs.readFile(skillUri);
			const text = Buffer.from(bytes).toString('utf8');
			const parts = text.split(/^---\s*$/m);
			return parts.length >= 3 ? parts.slice(2).join('---').trim() : text.trim();
		} catch (error) {
			this.log.warn(`Failed to resolve skill: ${error}`);
			return undefined;
		}
	}
}