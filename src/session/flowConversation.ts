/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { IFlowContext } from '../context/flowContextBuilder';

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
export class FlowTurn {
	readonly id: string = uuidv4();
	readonly timestamp: Date = new Date();
	
	/**
	 * Responses from each role in the panel
	 * Map of role name to response text
	 */
	responses: Map<string, string> = new Map();
	
	constructor(
		public readonly query: string,
		public readonly context: IFlowContext
	) {}
}

/**
 * Represents a complete panel conversation with multiple turns
 */
export class FlowConversation {
	readonly sessionId: string = uuidv4();
	private turns: FlowTurn[] = [];
	
	/**
	 * Add a new turn to the conversation
	 */
	addTurn(query: string, context: IFlowContext): FlowTurn {
		const turn = new FlowTurn(query, context);
		this.turns.push(turn);
		return turn;
	}
	
	/**
	 * Get all turns in the conversation
	 */
	getHistory(): FlowTurn[] {
		return this.turns;
	}
	
	/**
	 * Get the most recent turn
	 */
	getLastTurn(): FlowTurn | undefined {
		return this.turns[this.turns.length - 1];
	}
}

/**
 * In-memory store for panel conversations
 * Conversations are stored per VS Code chat session
 */
export class FlowConversationStore {
	private conversations = new Map<string, FlowConversation>();
	
	/**
	 * Get or create a conversation for a given session ID
	 */
	getOrCreate(sessionId: string): FlowConversation {
		let conversation = this.conversations.get(sessionId);
		if (!conversation) {
			conversation = new FlowConversation();
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
