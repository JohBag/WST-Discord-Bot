import Anthropic from '@anthropic-ai/sdk';
import { secrets } from '../core/config.js';
import { formatMessage } from './conversation.js';
import type { ChatMessage, ChatReply, ReplyRequest } from './conversation.js';
import { tools } from './tools.js';

// Replies are kept short by the prompt; this only stops a runaway answer
const maxTokens = 1024;
// Searches allowed per reply, which keeps the cost and the wait down
const maxSearches = 2;

let client: Anthropic | undefined;

// Created on first use, so the bot runs without an Anthropic key as long as no Claude model is configured
function getClient(): Anthropic {
	if (!secrets.keys.anthropic) {
		throw new Error('ANTHROPIC_API_KEY is not set');
	}
	client ??= new Anthropic({ apiKey: secrets.keys.anthropic });
	return client;
}

interface ClaudeMessage {
	role: 'user' | 'assistant';
	content: string;
}

// Claude expects turns that start with someone else's message and end on one to reply to.
// Several people talking in a row become a single turn, one line each.
export function toClaudeMessages(conversation: ChatMessage[]): ClaudeMessage[] {
	const messages: ClaudeMessage[] = [];
	for (const message of conversation) {
		const role = message.fromBot ? 'assistant' : 'user';
		const last = messages.at(-1);
		if (last?.role === role) {
			last.content += '\n' + formatMessage(message);
		} else {
			messages.push({ role, content: formatMessage(message) });
		}
	}

	while (messages[0]?.role === 'assistant') {
		messages.shift();
	}
	while (messages.at(-1)?.role === 'assistant') {
		messages.pop();
	}
	return messages;
}

export async function generateClaudeReply(request: ReplyRequest): Promise<ChatReply> {
	const messages = toClaudeMessages(request.conversation);
	if (messages.length === 0) {
		throw new Error('There is no message to reply to');
	}

	const allowedTools: Anthropic.Messages.ToolUnion[] = [];
	if (request.tools) {
		allowedTools.push(...tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })));
	}
	if (request.webSearch) {
		allowedTools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches });
	}

	const response = await getClient().messages.create({
		model: request.model,
		max_tokens: maxTokens,
		system: request.systemPrompt,
		messages,
		tools: allowedTools.length > 0 ? allowedTools : undefined,
	});

	// Claude may say something before searching ("Let me check"); the reply is what follows the last search
	const afterSearch = response.content.map(block => block.type).lastIndexOf('web_search_tool_result') + 1;
	return {
		text: response.content.slice(afterSearch).map(block => block.type === 'text' ? block.text : '').join('').trim(),
		toolCalls: response.content.flatMap(block => block.type === 'tool_use'
			? [{ name: block.name, args: block.input as Record<string, any> }]
			: []),
		usage: {
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
			searches: response.usage.server_tool_use?.web_search_requests ?? 0,
		},
	};
}
