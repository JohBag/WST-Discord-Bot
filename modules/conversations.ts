import getUsername from './get-username.js';
import { config } from './data.js';
import log from './log.js';
import type { Message } from 'discord.js';

export interface ConversationEntry {
	role: 'model' | 'user';
	parts: { text: string }[];
}

// Shared with the prompt test harness so tests see the exact same formatting the bot sends
export function toConversationEntry(username: string, content: string, botName: string = config.name): ConversationEntry {
	return {
		role: username === botName ? 'model' : 'user',
		parts: [{ text: `${username}: ${content}` }]
	};
}

export default async function getConversation(interaction: Message, messageLimit: number): Promise<ConversationEntry[] | undefined> {
	let messages = await getMessages(interaction, messageLimit);

	messages = filterByDate(messages);
	messages = filterByCutoff(messages);
	messages = filterEmpty(messages);

	if (messages.length === 0) {
		log('No messages remaining.');
		return;
	}

	return await formatConversation(messages);
}

async function getMessages(interaction: Message, messageLimit: number): Promise<Message[]> {
	const IdsToMessages = await interaction.channel.messages.fetch({ limit: messageLimit });
	return Array.from(IdsToMessages.values());
}

async function formatConversation(messages: Message[]): Promise<ConversationEntry[]> {
	const conversation = await Promise.all(
		messages.map(async (message) => {
			const username = await getUsername(message);
			return toConversationEntry(username, message.content);
		})
	);

	conversation.reverse();

	return conversation;
}

function filterByDate(messages: Message[]): Message[] {
	const ageLimit = config.chat.ageLimitDays * (1000 * 60 * 60 * 24);
	const currentDate = new Date();
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const messageDate = new Date(message.createdTimestamp);
		const age = currentDate.getTime() - messageDate.getTime();

		if (age > ageLimit) {
			messages = messages.slice(0, i);
			break;
		}
	}

	return messages;
}

function filterByCutoff(messages: Message[]): Message[] {
	const cutoffIndex = messages.findIndex((message) => message.content === config.chat.cutoff);
	return cutoffIndex === -1 ? messages : messages.slice(0, cutoffIndex);
}

function filterEmpty(messages: Message[]): Message[] {
	return messages.filter((message) => message.content.trim() !== '');
}
