/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IPanelConfig, IRoleResponse, PanelService } from './panelService';
import { PanelContextBuilder, IPanelContext } from '../context/panelContextBuilder';
import { PanelConversationStore, PanelConversation, PanelTurn } from '../session/panelConversation';
import { PanelPromptRenderer } from '../prompts/panelPromptRenderer';
import { ToolCallRound } from '../prompts/panelTools';
import { normalizeToolSchemas } from '../util/toolSchemaNormalizer';
import { filterTools, shouldFilterTools } from '../util/toolFilter';
import { CopilotSdkExecutor } from '../util/copilotSdkExecutor';

/**
 * Chat participant that orchestrates panel discussions
 */
export class PanelParticipant {
	private readonly panelService: PanelService;
	private readonly contextBuilder: PanelContextBuilder;
	private readonly conversationStore: PanelConversationStore;
	private readonly promptRenderer: PanelPromptRenderer;
	private readonly sdkExecutor: CopilotSdkExecutor;
	
	constructor(private readonly context: vscode.ExtensionContext) {
		this.panelService = new PanelService();
		this.contextBuilder = new PanelContextBuilder();
		this.conversationStore = new PanelConversationStore();
		this.promptRenderer = new PanelPromptRenderer();
		this.sdkExecutor = new CopilotSdkExecutor();
	}
	
	/**
	 * Register the @panel participant
	 */
	register(): vscode.Disposable {
		const participant = vscode.chat.createChatParticipant(
			'ix.copilot-ai-panel',
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
			// Step 1: Find the prompt file from references
			const promptFileUri = this.findPromptFile(request);
			
			if (!promptFileUri) {
				stream.markdown('**Usage**: Please attach a `.prompt.md` file that defines the panel roles.\n\n');
				stream.markdown('Example: `@panel #file:./sprint-planning.prompt.md What should we prioritize?`\n\n');
				stream.markdown('Browse the library with the command: `AI Panel: Browse Prompt Library`');
				return {};
			}
			
			// Step 2: Parse the panel configuration
			stream.progress('Parsing panel configuration...');
			const config = await this.panelService.parsePrompt(promptFileUri);
			
			if (!config) {
				stream.markdown('❌ **Error**: Failed to parse prompt file. Please check the format.');
				return { errorDetails: { message: 'Invalid prompt file format' } };
			}
			
			// Step 3: Validate configuration
			const validation = this.panelService.validate(config);
			if (!validation.valid) {
				stream.markdown('❌ **Validation Errors**:\n\n');
				for (const error of validation.errors) {
					stream.markdown(`- ${error}\n`);
				}
				return { errorDetails: { message: 'Invalid panel configuration' } };
			}
			
			// Step 4: Show what we're doing
			stream.markdown(`## ${config.name}\n\n`);
			if (config.description) {
				stream.markdown(`${config.description}\n\n`);
			}
			stream.markdown(`**Panel**: ${config.roles.map(r => r.name).join(', ')}\n\n`);
			stream.markdown(`**Mode**: ${config.orchestration}\n\n`);
			
			if (config.maxRounds > 1) {
				stream.markdown(`**Rounds**: ${config.maxRounds}\n\n`);
			}
			
			if (config.tools && config.tools.length > 0) {
				stream.markdown(`**Tools**: ${config.tools.join(', ')}\n\n`);
			}
			
			stream.markdown('---\n\n');
			
			// Step 5: Build rich context and manage conversation
			const vsCodeContext = this.contextBuilder.buildContext(request);
			// Use conversation history to create session ID
			const sessionId = context.history.length > 0 ? 'session-' + Date.now() : 'new-session';
			const conversation = this.conversationStore.getOrCreate(sessionId);
			const currentTurn = conversation.addTurn(request.prompt, vsCodeContext);
			
			// Step 6: Execute the orchestration strategy
			if (token.isCancellationRequested) {
				return {};
			}
			
			switch (config.orchestration) {
				case 'sequential':
					await this.executeSequential(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token, request.toolInvocationToken);
					break;
				case 'all-respond':
					await this.executeAllRespond(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token, request.toolInvocationToken);
					break;
				case 'round-robin':
					await this.executeRoundRobin(config, request.prompt, vsCodeContext, conversation, currentTurn, stream, token, request.toolInvocationToken);
					break;
			}
			
			return {
				metadata: {
					roles: config.roles.map(r => r.name),
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
	
	/**
	 * Find the prompt.md file from request references
	 */
	private findPromptFile(request: vscode.ChatRequest): vscode.Uri | undefined {
		for (const ref of request.references) {
			if (ref.value instanceof vscode.Uri) {
				const path = ref.value.path.toLowerCase();
				if (path.endsWith('.prompt.md') || path.endsWith('.md')) {
					return ref.value;
				}
			}
		}
		return undefined;
	}
	
	/**
	 * Get tools array from panel config
	 */
	private getPanelTools(config: IPanelConfig): { tools: vscode.LanguageModelChatTool[] | undefined; missingTools: string[] } {
		if (!config.tools || config.tools.length === 0) {
			return { tools: undefined, missingTools: [] };
		}
		
		// Get all available tools - this could be undefined
		const allTools = vscode.lm.tools;
		if (!allTools) {
			console.warn('[PanelParticipant] vscode.lm.tools is undefined');
			return { tools: undefined, missingTools: config.tools };
		}
		
		// Handle wildcard '*' to include all tools
		if (config.tools.includes('*')) {
			console.log(`[PanelParticipant] Wildcard '*' detected - ${allTools.length} tools available`);
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
			console.warn('[PanelParticipant] Tools not found:', unmatchedTools);
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
		config: IPanelConfig,
		userQuery: string,
		vsCodeContext: IPanelContext,
		conversation: PanelConversation,
		currentTurn: PanelTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined
	): Promise<void> {
		
		const { tools, missingTools } = this.getPanelTools(config);
		
		// Warn user about missing tools
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: The following tools are not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
			stream.markdown(`💡 **Tip**: Run the command "AI Panel: List Available Tools" to see registered tools.\n\n`);
		}
		
		for (const role of config.roles) {
			if (token.isCancellationRequested) {
				return;
			}
			
			stream.progress(`${role.name} is thinking...`);
			
			const response = await this.callRole(
				role, 
				userQuery, 
				vsCodeContext, 
				config.sharedContext, 
				conversation.getHistory().slice(0, -1), // Exclude current turn
				tools,
				stream,
				token,
				toolInvocationToken
			);
			
			// Save response
			currentTurn.responses.set(role.name, response.content);
			
			// Render the response
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
	}
	
	/**
	 * All-respond orchestration: all roles respond in parallel
	 */
	private async executeAllRespond(
		config: IPanelConfig,
		userQuery: string,
		vsCodeContext: IPanelContext,
		conversation: PanelConversation,
		currentTurn: PanelTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined
	): Promise<void> {
		
		stream.progress('All panelists are thinking...');
		
		const { tools, missingTools } = this.getPanelTools(config);
		const history = conversation.getHistory().slice(0, -1);
		
		// Warn user about missing tools
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: The following tools are not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
			stream.markdown(`💡 **Tip**: Run the command "AI Panel: List Available Tools" to see registered tools.\n\n`);
		}
		
		// Check if SDK mode is enabled
		if (config.useCli) {
			// Validate SDK availability
			const availability = await this.sdkExecutor.checkAvailability();
			if (!availability.available) {
				stream.markdown(`⚠️ **SDK Mode Warning**: ${availability.error}\n\n`);
				stream.markdown(`💡 Falling back to language model API...\n\n`);
				// Fall back to API mode
			} else {
				stream.markdown(`✅ Using GitHub Copilot SDK for role execution\n\n`);
				
				// Call all roles in parallel using SDK
				const responsePromises = config.roles.map(role => 
					this.callRoleSdk(role, userQuery, vsCodeContext, config.sharedContext, history, stream, token)
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
				return;
			}
		}
		
		// Standard API mode (existing implementation)
		// Call all roles in parallel
		const responsePromises = config.roles.map(role => 
			this.callRole(role, userQuery, vsCodeContext, config.sharedContext, history, tools, stream, token, toolInvocationToken)
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
	}
	
	/**
	 * Round-robin orchestration: multiple rounds of discussion
	 */
	private async executeRoundRobin(
		config: IPanelConfig,
		userQuery: string,
		vsCodeContext: IPanelContext,
		conversation: PanelConversation,
		currentTurn: PanelTurn,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined
	): Promise<void> {
		
		const { tools, missingTools } = this.getPanelTools(config);
		
		// Warn user about missing tools
		if (missingTools.length > 0) {
			stream.markdown(`⚠️ **Warning**: The following tools are not available and will be ignored: \`${missingTools.join('`, `')}\`\n\n`);
			stream.markdown(`💡 **Tip**: Run the command "AI Panel: List Available Tools" to see registered tools.\n\n`);
		}
		
		for (let round = 1; round <= config.maxRounds; round++) {
			if (token.isCancellationRequested) {
				return;
			}
			
			stream.markdown(`## Round ${round}\n\n`);
			
			for (const role of config.roles) {
				if (token.isCancellationRequested) {
					return;
				}
				
				stream.progress(`Round ${round}: ${role.name} is thinking...`);
				
				const response = await this.callRole(
					role, 
					userQuery, 
					vsCodeContext, 
					config.sharedContext,
					conversation.getHistory().slice(0, -1),
					tools,
					stream,
					token,
					toolInvocationToken
				);
				
				// Save response
				currentTurn.responses.set(role.name, response.content);
				
				// Render the response
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
		}
	}
	
	/**
	 * Call a role using GitHub Copilot SDK
	 * Simpler execution without tool loops - SDK handles everything
	 */
	private async callRoleSdk(
		role: { name: string; systemPrompt: string; model?: string },
		userQuery: string,
		vsCodeContext: IPanelContext,
		sharedContext: string,
		history: PanelTurn[],
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<IRoleResponse> {
		try {
			// Execute via SDK
			const result = await this.sdkExecutor.executeCopilotSdk({
				roleName: role.name,
				systemPrompt: role.systemPrompt,
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
			console.error(`[PanelParticipant] Error in callRoleSdk for ${role.name}:`, error);
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
		role: { name: string; systemPrompt: string; model?: string },
		userQuery: string,
		vsCodeContext: IPanelContext,
		sharedContext: string,
		history: PanelTurn[],
		tools: vscode.LanguageModelChatTool[] | undefined,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken,
		toolInvocationToken: vscode.ChatParticipantToolToken | undefined
	): Promise<IRoleResponse> {
		
		try {
			// Determine which model to use
			const modelName = role.model || 'gpt-4';
			
			// Get available language models
			const models = await vscode.lm.selectChatModels({
				vendor: 'copilot',
				family: modelName.toLowerCase().includes('gpt') ? 'gpt-4' : undefined
			});
			
			if (models.length === 0) {
				// Fallback to any available model
				const allModels = await vscode.lm.selectChatModels();
				if (allModels.length > 0) {
					models.push(allModels[0]);
				}
			}
			
			if (models.length === 0) {
				return {
					roleName: role.name,
					content: '',
					model: modelName,
					error: 'No language model available'
				};
			}
			
			const model = models[0];
			
			// Tool execution loop: continue until no more tool calls
			let responseText = '';
			const maxToolRounds = 100; // Prevent infinite loops
			let toolRound = 0;
			const toolCallRounds: ToolCallRound[] = [];
			const toolCallResults: Record<string, vscode.LanguageModelToolResult> = {};
			
			while (toolRound < maxToolRounds) {
				if (token.isCancellationRequested) {
					break;
				}
				
				console.log(`[PanelParticipant] Starting tool round ${toolRound + 1} of ${maxToolRounds} for role ${role.name}`);
			console.log(`[PanelParticipant] Current state: ${toolCallRounds.length} rounds, ${Object.keys(toolCallResults).length} cached results`);

			// Render prompt using Prompt-TSX
			const renderResult = await this.promptRenderer.renderRolePrompt(
				role.name,
				role.systemPrompt,
				userQuery,
				vsCodeContext,
				sharedContext,
				history,
				8000,
				toolCallRounds,
				toolCallResults,
				toolInvocationToken
			);
			
			console.log(`[PanelParticipant] Prompt rendered: ${renderResult.messages.length} messages, ${Object.keys(renderResult.toolCallResults).length} tool results`);
			const messages = renderResult.messages;
				
				// Build request options with tools if available
				const options: vscode.LanguageModelChatRequestOptions = {};
				if (tools && tools.length > 0) {
					// Apply smart tool filtering based on query if we have too many tools
					let filteredTools = tools;
					if (shouldFilterTools(tools.length)) {
						console.log(`[PanelParticipant] Applying smart tool filtering (${tools.length} -> max 128)`);
						filteredTools = filterTools(tools, userQuery);
					}
					
					// Normalize tool schemas to avoid "object schema missing properties" error
					const normalizedTools = normalizeToolSchemas(filteredTools);
					options.tools = normalizedTools;
					console.log(`[PanelParticipant] Using ${normalizedTools.length} tools for request`);
				}
				
				// Call the model
				const chatRequest = await model.sendRequest(messages, options, token);
				
				// Process the stream
				const toolCalls: vscode.LanguageModelToolCallPart[] = [];
				let roundText = '';
				
				for await (const part of chatRequest.stream) {
					if (token.isCancellationRequested) {
						break;
					}
					
					if (part instanceof vscode.LanguageModelTextPart) {
						roundText += part.value;
					} else if (part instanceof vscode.LanguageModelToolCallPart) {
						// Model wants to call a tool
						toolCalls.push(part);
						console.log(`[PanelParticipant] Received tool call: ${part.name} (callId: ${part.callId})`);
					}
				}
				
				// Accumulate text response
				responseText += roundText;
				
				console.log(`[PanelParticipant] Round ${toolRound + 1}: roundText="${roundText}", toolCalls=${toolCalls.length}, accumulated responseText length=${responseText.length}`);
				
				// If no tool calls, we're done
				if (toolCalls.length === 0) {
					console.log(`[PanelParticipant] No tool calls in round ${toolRound + 1}, exiting loop`);
					break;
				}

				// Add to tool call rounds
				toolCallRounds.push({
					response: roundText,
					toolCalls
				});
				
				console.log(`[PanelParticipant] Tool round ${toolRound + 1} complete. Continuing to round ${toolRound + 2}...`);
				
				// Report progress for next round
				stream.progress(`Processing tool results (round ${toolRound + 1}/${maxToolRounds})...`);
				
				toolRound++;
			}
			
			if (toolRound >= maxToolRounds) {
				console.warn(`[PanelParticipant] Role ${role.name} hit max tool rounds (${maxToolRounds}). May not have completed successfully.`);
			}
			
			const finalContent = responseText.trim();
			if (!finalContent) {
				console.warn(`[PanelParticipant] Role ${role.name} completed ${toolRound} tool rounds but returned empty content`);
			} else {
				console.log(`[PanelParticipant] Role ${role.name} completed with ${finalContent.length} characters after ${toolRound} tool rounds`);
			}
			
			return {
				roleName: role.name,
				content: finalContent,
				model: model.name
			};
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : '';
			console.error(`[PanelParticipant] Error in callRole for ${role.name}:`, errorMessage, errorStack);
			return {
				roleName: role.name,
				content: '',
				model: role.model || 'unknown',
				error: errorMessage
			};
		}
	}
}
