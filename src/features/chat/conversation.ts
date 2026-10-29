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

export interface Conversation {
	messages: ChatMessage[];
	// When the newest message read was sent, so later ones can be told apart from those already seen
	seenUntil: number;
}

// What each recent reply had read, as the time of the newest message it saw, by message ID
const replies = new Map<string, number>();
const rememberedReplies = 200;

export default async function getConversation(interaction: Message): Promise<Conversation> {
	const fetched = await getMessages(interaction, config.chat.history.maxMessages);
	const seenUntil = fetched[0]?.createdTimestamp ?? interaction.createdTimestamp;
	const messages = placeReplies(filterHistory(fetched, Date.now()));

	if (messages.length === 0) {
		log('No messages remaining.');
	}

	return { messages: await formatConversation(messages), seenUntil };
}

export function rememberReply(messageIds: string[], seenUntil: number): void {
	for (const id of messageIds) {
		replies.set(id, seenUntil);
	}
	// Maps keep insertion order, so the oldest replies go first
	for (const id of replies.keys()) {
		if (replies.size <= rememberedReplies) {
			break;
		}
		replies.delete(id);
	}
}

// Takes messages newest first. A reply lands after messages sent while it was being written, which it
// never read, so the next reply would take those as answered. Moving each reply back to right after
// the newest message it had read shows them as still open.
export function placeReplies<T extends { id: string; createdTimestamp: number }>(messages: T[]): T[] {
	const placedAt = (message: T) => replies.get(message.id) ?? message.createdTimestamp;
	// A reply counts as newer than the message it follows. Sorting is stable, so a split reply keeps its order.
	return [...messages].sort((a, b) => placedAt(b) - placedAt(a) || Number(replies.has(b.id)) - Number(replies.has(a.id)));
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

// Takes messages newest first and keeps the current conversation: the non-empty messages after the
// last reset marker, back to the first long pause, but at least a few if there are recent ones
export function filterHistory<T extends HistoryMessage>(messages: T[], now: number): T[] {
	messages = filterByDate(messages, now);
	messages = filterByResetMarker(messages);
	messages = filterEmpty(messages);
	return filterByPause(messages);
}

// A busy thread is followed back to where it started, while a quiet channel still gives some context
function filterByPause<T extends HistoryMessage>(messages: T[]): T[] {
	const { minMessages, gapMinutes } = config.chat.history;
	const gap = gapMinutes * 60 * 1000;
	for (let i = Math.max(minMessages, 1); i < messages.length; i++) {
		if (messages[i - 1].createdTimestamp - messages[i].createdTimestamp > gap) {
			return messages.slice(0, i);
		}
	}
	return messages;
}

function filterByDate<T extends HistoryMessage>(messages: T[], now: number): T[] {
	const ageLimit = config.chat.history.maxAgeDays * (1000 * 60 * 60 * 24);
	const tooOld = messages.findIndex(message => now - message.createdTimestamp > ageLimit);
	return tooOld === -1 ? messages : messages.slice(0, tooOld);
}

function filterByResetMarker<T extends HistoryMessage>(messages: T[]): T[] {
	const resetIndex = messages.findIndex((message) => message.content === config.chat.history.resetMarker);
	return resetIndex === -1 ? messages : messages.slice(0, resetIndex);
}

function filterEmpty<T extends HistoryMessage>(messages: T[]): T[] {
	return messages.filter((message) => message.content.trim() !== '');
}
