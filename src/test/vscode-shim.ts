/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

/**
 * Mock VS Code LanguageModelChatMessageRole enum
 */
export enum LanguageModelChatMessageRole {
	User = 1,
	Assistant = 2,
	System = 3
}

/**
 * Mock LanguageModelTextPart class
 */
export class LanguageModelTextPart {
	constructor(public value: string) {}
}

/**
 * Mock LanguageModelToolCallPart class
 */
export class LanguageModelToolCallPart {
	constructor(
		public name: string,
		public callId: string,
		public input: unknown
	) {}
}

/**
 * Mock LanguageModelToolResult class
 */
export class LanguageModelToolResult {
	constructor(public content: vscode.LanguageModelTextPart[]) {}
}

/**
 * Mock LanguageModelChatMessage interface
 */
export class LanguageModelChatMessage {
	role: LanguageModelChatMessageRole;
	content: string | vscode.LanguageModelTextPart[];
	name?: string;
	
	constructor(
		role: LanguageModelChatMessageRole,
		content: string | vscode.LanguageModelTextPart[],
		name?: string
	) {
		this.role = role;
		this.content = content;
		this.name = name;
	}
	
	/**
	 * Utility to create a new user message
	 */
	static User(content: string | vscode.LanguageModelTextPart[], name?: string): LanguageModelChatMessage {
		return new LanguageModelChatMessage(LanguageModelChatMessageRole.User, content, name);
	}
	
	/**
	 * Utility to create a new assistant message
	 */
	static Assistant(content: string | vscode.LanguageModelTextPart[], name?: string): LanguageModelChatMessage {
		return new LanguageModelChatMessage(LanguageModelChatMessageRole.Assistant, content, name);
	}
}

/**
 * Mock CancellationToken
 */
export interface CancellationToken {
	isCancellationRequested: boolean;
	onCancellationRequested: () => void;
}

/**
 * Mock CancellationTokenSource
 */
export class CancellationTokenSource {
	token: CancellationToken = {
		isCancellationRequested: false,
		onCancellationRequested: () => {}
	};
	
	cancel() {
		this.token.isCancellationRequested = true;
	}
	
	dispose() {}
}

/**
 * Mock Uri
 */
export class Uri {
	constructor(
		public scheme: string,
		public authority: string,
		public path: string,
		public query: string,
		public fragment: string
	) {}
	
	get fsPath(): string {
		return this.path;
	}
	
	static file(path: string): Uri {
		return new Uri('file', '', path, '', '');
	}
	
	static parse(value: string): Uri {
		return new Uri('file', '', value, '', '');
	}
}

/**
 * Mock ChatPromptReference
 */
export interface ChatPromptReference {
	id: string;
	value: unknown;
}

/**
 * Mock ChatParticipantToolToken
 */
export interface ChatParticipantToolToken {}

/**
 * Mock lm namespace
 */
export const lm = {
	tools: [] as unknown[],
	selectChatModels: async () => [
		{
			id: 'test-model',
			vendor: 'test',
			family: 'test',
			version: '1.0',
			maxInputTokens: 4096,
			countTokens: async (text: string | vscode.LanguageModelChatMessage) => {
				// Handle message object
				if (typeof text === 'object' && text !== null && 'content' in text) {
					const message = text as vscode.LanguageModelChatMessage;
					const content = message.content;
					if (typeof content === 'string') {
					return (content as string).length / 4;
					} else if (Array.isArray(content)) {
						return content.reduce((sum: number, part: unknown) => {
							const textPart = part as vscode.LanguageModelTextPart;
							return sum + (textPart.value?.length || 0) / 4;
						}, 0);
					}
				}
				// Handle string
				if (typeof text === 'string') {
					return text.length / 4;
				}
				// Handle undefined/null
				console.error('[vscode-shim] countTokens received invalid input:', text);
				return 0;
			},
			sendRequest: async (_messages: unknown[], _options: unknown, _token?: CancellationToken) => ({
				text: async function* () {
					yield 'mock response';
				}
			})
		}
	] as unknown[],
	invokeTool: async (
		_tool: string,
		_options: unknown,
		_token?: CancellationToken
	): Promise<vscode.LanguageModelToolResult> => {
		return new LanguageModelToolResult([
			new LanguageModelTextPart('mock tool result')
		]);
	}
};

/**
 * Mock chat namespace
 */
export const chat = {
	createChatParticipant: () => ({})
};

/**
 * Mock window namespace
 */
export const window = {
	showInformationMessage: async () => {},
	showErrorMessage: async () => {},
	createOutputChannel: () => ({
		appendLine: () => {},
		show: () => {}
	})
};

/**
 * Mock workspace namespace  
 */
export const workspace = {
	workspaceFolders: undefined as unknown,
	name: undefined as unknown,
	fs: {
		readFile: async () => new Uint8Array(),
		writeFile: async () => {}
	}
};

// Export for CommonJS (used by @vscode/prompt-tsx)
module.exports = {
	LanguageModelChatMessageRole,
	LanguageModelTextPart,
	LanguageModelToolCallPart,
	LanguageModelToolResult,
	LanguageModelChatMessage,
	CancellationTokenSource,
	Uri,
	lm,
	chat,
	window,
	workspace,
};
