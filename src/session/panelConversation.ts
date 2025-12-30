/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { IPanelContext } from '../context/panelContextBuilder';

/**
 * Generate a simple UUID v4
 */
function uuidv4(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
 * Represents a single turn in a panel conversation
 */
export class PanelTurn {
	readonly id: string = uuidv4();
	readonly timestamp: Date = new Date();
	
	/**
	 * Responses from each role in the panel
	 * Map of role name to response text
	 */
	responses: Map<string, string> = new Map();
	
	constructor(
		public readonly query: string,
		public readonly context: IPanelContext
	) {}
}

/**
 * Represents a complete panel conversation with multiple turns
 */
export class PanelConversation {
	readonly sessionId: string = uuidv4();
	private turns: PanelTurn[] = [];
	
	/**
	 * Add a new turn to the conversation
	 */
	addTurn(query: string, context: IPanelContext): PanelTurn {
		const turn = new PanelTurn(query, context);
		this.turns.push(turn);
		return turn;
	}
	
	/**
	 * Get all turns in the conversation
	 */
	getHistory(): PanelTurn[] {
		return this.turns;
	}
	
	/**
	 * Get the most recent turn
	 */
	getLastTurn(): PanelTurn | undefined {
		return this.turns[this.turns.length - 1];
	}
}

/**
 * In-memory store for panel conversations
 * Conversations are stored per VS Code chat session
 */
export class PanelConversationStore {
	private conversations = new Map<string, PanelConversation>();
	
	/**
	 * Get or create a conversation for a given session ID
	 */
	getOrCreate(sessionId: string): PanelConversation {
		let conversation = this.conversations.get(sessionId);
		if (!conversation) {
			conversation = new PanelConversation();
			this.conversations.set(sessionId, conversation);
		}
		return conversation;
	}
	
	/**
	 * Clear all stored conversations
	 */
	clear(): void {
		this.conversations.clear();
	}
}
