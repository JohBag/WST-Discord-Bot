// Provider-neutral chat types, so the bot and the comparison tool can use any model

// One message from the chat history
export interface ChatMessage {
	author: string;
	content: string;
	// Written by the bot itself, which the model sees as its own earlier replies
	fromBot: boolean;
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
	};
}

export interface ReplyRequest {
	model: string;
	systemPrompt: string;
	// Oldest first
	conversation: ChatMessage[];
	// Whether the model may call the bot's tools (pictures, logs, votes)
	tools: boolean;
}

// Other people's messages are prefixed with their name so the model knows who said what. The bot's
// own are not, since the model would otherwise learn to start its replies with its name.
export function formatMessage(message: ChatMessage): string {
	return message.fromBot ? message.content : `${message.author}: ${message.content}`;
}
