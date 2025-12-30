/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Mock VS Code API for unit tests
 */

export enum LanguageModelChatMessageRole {
	User = 1,
	Assistant = 2
}

export class LanguageModelTextPart {
	constructor(public value: string) {}
}

export class LanguageModelToolCallPart {
	constructor(public name: string, public callId: string, public input: unknown) {}
}

export interface LanguageModelChatMessage {
	role: LanguageModelChatMessageRole;
	content: string | LanguageModelTextPart[];
}

export interface LanguageModelChat {
	id: string;
	vendor: string;
	family: string;
	version: string;
	name: string;
	maxInputTokens: number;
	countTokens(text: string | LanguageModelChatMessage): Promise<number>;
	sendRequest(messages: LanguageModelChatMessage[], options?: unknown, token?: unknown): Promise<unknown>;
}

export interface ChatParticipantToolToken {}

export interface CancellationToken {
	isCancellationRequested: boolean;
	onCancellationRequested: () => void;
}

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

export interface Uri {
	fsPath: string;
	path: string;
}

export interface ChatPromptReference {}

export interface LanguageModelToolResult {
	content: LanguageModelTextPart[];
}

export const lm = {
	tools: [],
	selectChatModels: async () => [],
	invokeTool: async () => ({
		content: [new LanguageModelTextPart('mock tool result')]
	})
};

export const chat = {
	createChatParticipant: () => ({})
};

