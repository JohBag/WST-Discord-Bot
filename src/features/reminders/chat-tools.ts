import type { ChatInputCommandInteraction, EmbedBuilder, GuildMember, Message as DiscordMessage } from 'discord.js';
import Message from '../../core/message.js';
import UserError from '../../core/user-error.js';
import type { ToolCall } from '../../ai/conversation.js';
import { chatCancel, chatList, isOfficerMember, setReminder, updateCard } from './actions.js';
import { confirmationCard, shorten } from './format.js';
import { loadReminders, saveReminders, setConfirmation } from './store.js';
import type { Reminder, ReminderTarget } from './store.js';
import { config } from '../../core/config.js';
import getChannelSettings from '../chat/channel-settings.js';
import { isToBot } from '../chat/should-respond.js';

// The reminder tools the chat model calls. Their message replaces Botty's reply, and nobody gets
// pinged by it

const maxCallsPerReply = 5;

const targets: Record<string, ReminderTarget> = { asker: 'member', channel: 'channel', role: 'role' };

// Someone whose message the reply answers: a burst of pings from several people gets one reply, so
// the model names who asked and the reminder is theirs, with their rights
export interface Asker {
	userId: string;
	displayName: string;
	username: string;
	member: GuildMember | null;
	messageId?: string;
}

// The people who spoke to Botty in the recent messages the model sees, newest first. Each reminder
// is checked against its own asker's rights, so an earlier request can't borrow someone else's. A
// slash command trigger is just its user
export async function askersFor(trigger: DiscordMessage | ChatInputCommandInteraction, seenUntil: number): Promise<Asker[]> {
	if (!('author' in trigger)) {
		const member = trigger.member as GuildMember | null;
		return [{ userId: trigger.user.id, displayName: member?.displayName ?? trigger.user.displayName, username: trigger.user.username, member }];
	}
	const recent = await trigger.channel.messages.fetch({ limit: Math.min(100, config.chat.history.maxMessages) }).catch(() => null);
	const reactChance = getChannelSettings(trigger.channelId).reactChance;
	const messages = [...(recent?.values() ?? [])]
		.filter(m => m.createdTimestamp <= seenUntil && (m.id === trigger.id || isToBot(m, reactChance)))
		.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
	if (!messages.some(m => m.id === trigger.id) && !trigger.author.bot) {
		messages.push(trigger);
	}
	return messages.map(m => ({
		userId: m.author.id,
		displayName: m.member?.displayName ?? m.author.displayName,
		username: m.author.username,
		member: m.member,
		messageId: m.id,
	}));
}

// The newest message from the person the model named. A name that matches nobody who spoke to Botty
// is refused rather than given to someone else. Only a missing name with one person writing is theirs
export function pickAsker(askers: Asker[], name: unknown): Asker | undefined {
	const wanted = String(name ?? '').trim().replace(/^@/, '').toLowerCase();
	if (!wanted) {
		return new Set(askers.map(a => a.userId)).size === 1 ? askers[0] : undefined;
	}
	return askers.find(a => a.displayName.trim().toLowerCase() === wanted || a.username.toLowerCase() === wanted);
}

interface ToolResult {
	text?: string;
	card?: EmbedBuilder;
	// A reminder just set, whose card's message is remembered once it's sent
	set?: Reminder;
}

function runTool(call: ToolCall, askers: Asker[], trigger: DiscordMessage | ChatInputCommandInteraction): ToolResult {
	const args = call.args;
	const asker = pickAsker(askers, args.asker);
	if (!asker) {
		throw new UserError('Who is that reminder for? Ask me again and I\'ll sort it.');
	}
	if (!trigger.guild) {
		throw new UserError('Reminders only work in the server.');
	}
	const isOfficer = isOfficerMember(asker.member);
	if (call.name === 'set_reminder') {
		const target = Object.hasOwn(targets, args.for) ? targets[args.for] : 'member';
		const roleName = String(args.role ?? '').replace(/^@/, '').toLowerCase();
		const role = target === 'role' ? trigger.guild.roles.cache.find(r => r.name.toLowerCase() === roleName) : undefined;
		if (target === 'role' && isOfficer && !role) {
			throw new UserError(`There's no role called ${args.role ?? 'that'}.`);
		}
		const reminder = setReminder({
			target,
			when: String(args.when ?? ''),
			text: String(args.text ?? ''),
			role,
			userId: asker.userId,
			userName: asker.displayName,
			guild: trigger.guild,
			channelId: trigger.channelId!,
			messageId: asker.messageId,
			isOfficer,
		});
		return { card: confirmationCard(reminder), set: reminder };
	}
	if (call.name === 'list_reminders') {
		return { card: chatList(asker.userId, asker.displayName, trigger.channelId!) };
	}
	const cancelled = chatCancel(args.number, asker.userId, isOfficer);
	updateCard(trigger.client, cancelled, 'cancelled');
	return { text: `Cancelled reminder #${cancelled.number}: ${shorten(cancelled.text, 80)}` };
}

// Every reminder call in the reply, so "remind me at 19 and at 20" sets both
export function reminderTools(calls: ToolCall[], askers: Asker[], trigger: DiscordMessage | ChatInputCommandInteraction): Message {
	// Each card is an embed, and a message holds at most 10 and 6000 characters of them
	const results: ToolResult[] = calls.slice(0, maxCallsPerReply).map(call => {
		try {
			return runTool(call, askers, trigger);
		} catch (error) {
			if (error instanceof UserError) {
				return { text: error.message } as ToolResult;
			}
			throw error;
		}
	});
	if (calls.length > maxCallsPerReply) {
		results.push({ text: `I can only handle ${maxCallsPerReply} reminders at once. Ask me again for the rest.` });
	}
	const message = new Message().setText(results.map(r => r.text).filter(Boolean).join('\n'));
	for (const result of results) {
		if (result.card) {
			message.addEmbed(result.card);
		}
	}
	message.allowedMentions = { parse: [] };
	const set = results.flatMap(r => r.set ?? []);
	if (set.length > 0) {
		message.onSend = async sent => {
			const store = loadReminders();
			if (set.map(r => setConfirmation(store, r.number, sent.id)).some(Boolean)) {
				saveReminders(store);
			}
		};
	}
	return message;
}
