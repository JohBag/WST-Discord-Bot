// Shared by the tools that compare models and prompts on saved conversations.
// Everything lives in the git-ignored eval/ folder, since the conversations are real guild messages.
import type { ChatMessage } from '../ai/conversation.js';

export const evalDir = 'eval';
export const conversationsDir = `${evalDir}/conversations`;
export const resultsDir = `${evalDir}/results`;
export const variantsFile = `${evalDir}/variants.json`;

// A conversation to reply to, ending on someone else's message
export interface EvalConversation {
	id: string;
	channel?: string;
	date?: string;
	messages: ChatMessage[];
	// What the bot actually replied at the time, compared blind with the candidates
	original?: string;
}

export interface Variant {
	// Defaults to the model and prompt file name
	name?: string;
	model: string;
	prompt: string;
}

export interface VariantsFile {
	// Replies per conversation from each variant, to see how much they vary
	runs: number;
	includeOriginal: boolean;
	variants: Variant[];
}
