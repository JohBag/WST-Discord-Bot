import getUsername from '../../core/get-username.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import type { Message } from 'discord.js';
import type { ChatMessage } from '../../ai/conversation.js';

// The parts of a message the history filters look at, so saved conversations can be filtered the same way
export interface HistoryMessage {
	createdTimestamp: number;
	content: string;
}

export default async function getConversation(interaction: Message, messageLimit: number): Promise<ChatMessage[] | undefined> {
	const messages = filterHistory(await getMessages(interaction, messageLimit), Date.now());

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

async function formatConversation(messages: Message[]): Promise<ChatMessage[]> {
	const conversation = await Promise.all(
		messages.map(async (message) => ({
			author: await getUsername(message),
			content: message.content,
			// Compare IDs rather than names, since server nicknames can differ from config.name
			fromBot: message.author.id === message.client.user.id,
		}))
	);

	conversation.reverse();

	return conversation;
}

// Takes messages newest first and keeps the recent, non-empty ones after the last cutoff marker
export function filterHistory<T extends HistoryMessage>(messages: T[], now: number): T[] {
	messages = filterByDate(messages, now);
	messages = filterByCutoff(messages);
	return filterEmpty(messages);
}

function filterByDate<T extends HistoryMessage>(messages: T[], now: number): T[] {
	const ageLimit = config.chat.ageLimitDays * (1000 * 60 * 60 * 24);
	const tooOld = messages.findIndex(message => now - message.createdTimestamp > ageLimit);
	return tooOld === -1 ? messages : messages.slice(0, tooOld);
}

function filterByCutoff<T extends HistoryMessage>(messages: T[]): T[] {
	const cutoffIndex = messages.findIndex((message) => message.content === config.chat.cutoff);
	return cutoffIndex === -1 ? messages : messages.slice(0, cutoffIndex);
}

function filterEmpty<T extends HistoryMessage>(messages: T[]): T[] {
	return messages.filter((message) => message.content.trim() !== '');
}
