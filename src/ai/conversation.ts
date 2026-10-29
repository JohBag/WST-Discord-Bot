// Provider-neutral chat types, so the bot and the comparison tool can use any model

// One message from the chat history
export interface ChatMessage {
	author: string;
	content: string;
	// Written by the bot itself, which the model sees as its own earlier replies
	fromBot: boolean;
	// The message this one answers with Discord's reply button, shortened
	replyTo?: { author: string; content: string };
	// Pictures in the message the model can look at
	images?: ChatImage[];
}

export interface ChatImage {
	mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
	// Base64
	data: string;
}

export interface ToolCall {
	name: string;
	args: Record<string, any>;
}

export interface ChatReply {
	text: string;
	toolCalls: ToolCall[];
	usage: {
		inputTokens: number;
		outputTokens: number;
		// Web searches made while writing the reply
		searches: number;
	};
}

export interface ReplyRequest {
	model: string;
	systemPrompt: string;
	// Oldest first
	conversation: ChatMessage[];
	// Whether the model may call the bot's tools (pictures, logs, votes)
	tools: boolean;
	// Whether the model may search the web, which the provider does on its side
	webSearch?: boolean;
}

// Other people's messages are prefixed with their name so the model knows who said what. The bot's
// own are not, since the model would otherwise learn to start its replies with its name.
export function formatMessage(message: ChatMessage): string {
	if (message.fromBot) {
		return message.content;
	}
	const replyTo = message.replyTo ? ` (replying to ${message.replyTo.author}: "${message.replyTo.content}")` : '';
	return `${message.author}${replyTo}: ${message.content}`;
}
