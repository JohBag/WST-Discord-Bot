import log from '../core/log.js';
import { generateClaudeReply } from './claude.js';
import { generateGeminiReply } from './gemini.js';
import type { ChatReply, ReplyRequest } from './conversation.js';

export type Provider = 'claude' | 'gemini';

// The provider is picked from the model name, so switching is only a config change
export function getProvider(model: string): Provider {
	if (model.startsWith('claude-')) {
		return 'claude';
	}
	if (model.startsWith('gemini-')) {
		return 'gemini';
	}
	throw new Error(`Unknown model "${model}": expected a name starting with claude- or gemini-`);
}

export async function generateReply(request: ReplyRequest): Promise<ChatReply> {
	log(`Generating response with ${request.model}`);
	return getProvider(request.model) === 'claude'
		? generateClaudeReply(request)
		: generateGeminiReply(request);
}
