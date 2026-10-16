import { secrets } from "../core/config.js";
import log from '../core/log.js';
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";
import { config } from '../core/config.js';
import Message from '../core/message.js';
import { formatMessage } from './conversation.js';
import type { ChatMessage, ChatReply, ReplyRequest } from './conversation.js';
import { tools } from './tools.js';

let client: GoogleGenAI | undefined;

// Created on first use, so tools that only use Claude don't need a Gemini key
function getClient(): GoogleGenAI {
	if (!secrets.keys.gemini) {
		throw new Error('GEMINI_API_KEY is not set');
	}
	client ??= new GoogleGenAI({ apiKey: secrets.keys.gemini });
	return client;
}

export function toGeminiContents(conversation: ChatMessage[]): Content[] {
	return conversation.map(message => ({
		role: message.fromBot ? 'model' : 'user',
		parts: [{ text: formatMessage(message) }],
	}));
}

export async function generateGeminiReply(request: ReplyRequest): Promise<ChatReply> {
	const response = await getClient().models.generateContent({
		model: request.model,
		contents: toGeminiContents(request.conversation),
		config: {
			systemInstruction: request.systemPrompt,
			tools: request.tools
				? [{ functionDeclarations: tools.map(tool => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters })) }]
				: undefined,
		},
	});

	const usage = response.usageMetadata;
	// Read the parts directly, since response.text warns whenever there is also a function call
	const parts = response.candidates?.[0]?.content?.parts ?? [];
	return {
		text: parts.map(part => part.text && !part.thought ? part.text : '').join('').trim(),
		toolCalls: (response.functionCalls ?? []).map(call => ({ name: call.name ?? '', args: call.args ?? {} })),
		usage: {
			inputTokens: usage?.promptTokenCount ?? 0,
			// Thinking is billed as output
			outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
		},
	};
}

export async function generateImage(prompt: string): Promise<Message> {
	log("Generating image");

	const message = new Message();
	const response = await getClient().models.generateContent({
		model: config.models.image,
		contents: prompt,
	});
	for (const part of response.candidates![0].content!.parts!) {
		if (part.text) {
			message.addText(part.text);
		} else if (part.inlineData) {
			const imageData = part.inlineData.data!;
			const buffer = Buffer.from(imageData, "base64");
			fs.writeFileSync(config.media.imageFile, buffer);
			message.addFile(config.media.imageFile);
		}
	}

	return message;
}
