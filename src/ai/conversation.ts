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
	// Milliseconds since the message before it, set only after a long pause, so the model can tell
	// an old conversation from the one going on now
	pauseBefore?: number;
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
// own are not, since the model would otherwise learn to start its replies with its name. For the same
// reason a long pause is only marked before other people's messages.
export function formatMessage(message: ChatMessage): string {
	if (message.fromBot) {
		return message.content;
	}
	const pause = message.pauseBefore ? `(${describePause(message.pauseBefore)})\n` : '';
	const replyTo = message.replyTo ? ` (replying to ${message.replyTo.author}: "${message.replyTo.content}")` : '';
	return `${pause}${message.author}${replyTo}: ${message.content}`;
}

const hour = 60 * 60 * 1000;
const day = 24 * hour;

// "14 hours later", "2 days later"
export function describePause(ms: number): string {
	const [count, unit] = ms < day ? [Math.max(1, Math.round(ms / hour)), 'hour'] : [Math.round(ms / day), 'day'];
	return `${count} ${unit}${count === 1 ? '' : 's'} later`;
}
