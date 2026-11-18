import { EmbedBuilder } from 'discord.js';
import type { Reminder } from './store.js';

// The text of confirmations, lists and the reminder itself

const lateAfterMs = 2 * 60 * 1000;
// Lines in the list are cut so ten long reminders and the channel's still fit one embed (4096)
const listTextLength = 80;
const maxListLength = 3800;

function stamp(ms: number, style: 'f' | 'F' | 'R'): string {
	return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

export function shorten(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Who a channel or role reminder is for, in front of its text. A member's own shows its channel
// when it fires somewhere else
function forWhom(reminder: Reminder, channelId: string): string {
	if (reminder.target === 'role') {
		return `<@&${reminder.roleId}>: `;
	}
	return reminder.target === 'channel' || reminder.channelId !== channelId ? `<#${reminder.channelId}>: ` : '';
}

export type CardState = 'set' | 'sent' | 'cancelled';

const cardColors: Record<CardState, number> = { set: 0x0099FF, sent: 0x95A5A6, cancelled: 0x95A5A6 };
const cardIcons: Record<CardState, string> = { set: '⏰', sent: '✅', cancelled: '❌' };
const cardSuffix: Record<CardState, string> = { set: '', sent: ' sent', cancelled: ' cancelled' };

// Who it's for, as Discord shows a mention inside an embed (no ping there)
function recipient(reminder: Reminder): string {
	return reminder.target === 'role' ? `<@&${reminder.roleId}>` : reminder.target === 'channel' ? `@here in <#${reminder.channelId}>` : `<@${reminder.userId}>`;
}

// The card that confirms a reminder, updated once it's sent or cancelled. Times show in each
// reader's own time zone
export function confirmationCard(reminder: Reminder, state: CardState = 'set', sent?: { url: string; at: number }): EmbedBuilder {
	const card = new EmbedBuilder()
		.setColor(cardColors[state])
		.setTitle(`${cardIcons[state]} Reminder #${reminder.number}${cardSuffix[state]}`)
		.setDescription(state === 'cancelled' ? `~~${reminder.text}~~` : reminder.text);
	const when = state === 'set' ? `${stamp(reminder.due, 'f')}\n${stamp(reminder.due, 'R')}`
		: state === 'sent' && sent ? `${stamp(sent.at, 'f')}\n[Jump to message](${sent.url})`
		: state === 'sent' ? stamp(reminder.due, 'f')
		: `~~${stamp(reminder.due, 'f')}~~`;
	card.addFields({ name: 'When', value: when, inline: true }, { name: 'For', value: recipient(reminder), inline: true });
	// A channel or role card isn't a reply to whoever asked, so it says who set it
	if (reminder.target !== 'member') {
		card.setFooter({ text: `Set by ${reminder.userName}` });
	}
	return card;
}

export function listLine(reminder: Reminder, channelId: string): string {
	return `\`#${reminder.number}\` ${stamp(reminder.due, 'f')} (${stamp(reminder.due, 'R')}) ${forWhom(reminder, channelId)}${shorten(reminder.text, listTextLength)}`;
}

// The list as a card: yours and the channel's under their headings
export function listCard(own: Reminder[], channel: Reminder[], channelId: string, empty?: string): EmbedBuilder {
	return new EmbedBuilder().setColor(cardColors.set).setTitle('⏰ Reminders').setDescription(listText(own, channel, channelId, empty));
}

export function listText(own: Reminder[], channel: Reminder[], channelId: string, empty = 'No reminders set. Set one with /remind, or ask me in chat.'): string {
	if (own.length === 0 && channel.length === 0) {
		return empty;
	}
	let length = 0;
	let left = own.length + channel.length;
	const section = (heading: string, reminders: Reminder[]) => {
		const lines = [heading];
		for (const reminder of reminders) {
			const line = listLine(reminder, channelId);
			if (length + line.length > maxListLength) {
				break;
			}
			length += line.length + 1;
			left -= 1;
			lines.push(line);
		}
		return lines.join('\n');
	};
	const sections: string[] = [];
	if (own.length > 0) {
		sections.push(section('**Your reminders**', own));
	}
	if (channel.length > 0) {
		sections.push(section('**This channel**', channel));
	}
	return sections.join('\n\n') + (left > 0 ? `\n+${left} more` : '');
}

function span(ms: number): string {
	const minutes = Math.max(1, Math.round(ms / 60000));
	const [count, unit] = minutes < 60 ? [minutes, 'minute'] : minutes < 48 * 60 ? [Math.round(minutes / 60), 'hour'] : [Math.round(minutes / 1440), 'day'];
	return count === 1 ? `a${unit === 'hour' ? 'n' : ''} ${unit}` : `${count} ${unit}s`;
}

// "in 3 hours", "in a day"
export function describeSpan(ms: number): string {
	return `in ${span(ms)}`;
}

// "3 hours ago", "2 days ago", "a minute ago"
export function describeAgo(ms: number): string {
	return `${span(ms)} ago`;
}

// For the cancel menu, which can't show Discord timestamps: how far off, the same for every reader
export function menuLabel(reminder: Reminder, now = Date.now()): string {
	return shorten(`#${reminder.number} ${describeSpan(reminder.due - now)}: ${reminder.text}`, 100);
}

// The task for the model when the reminder fires, added to Botty's usual prompt
export function voiceInstructions(reminder: Reminder, roleName: string | undefined, now = Date.now()): string {
	const audience = reminder.target === 'role' ? `everyone with the ${roleName ?? 'pinged'} role`
		: reminder.target === 'channel' ? 'everyone in the channel'
		: 'them';
	return [
		`You're posting a reminder right now. ${reminder.userName} asked you ${describeAgo(now - reminder.createdAt)} to remind ${audience}, and their next message is what to remind about. It was written for this moment, so a time in it like "in 15 minutes" counts from now.`,
		'Nudge them the way you would a guildmate, in your own voice, in one or two short sentences. Keep everything it says (what, when, names) and add no new facts.',
		"A ⏰ and the ping go in front of your message and a note says who set it, so don't start with \"Reminder\", don't use ⏰, and don't name who it's for or who set it.",
	].join(' ');
}

// Only the ping in front may reach everyone: an @everyone or @here anywhere else (Botty's words, a
// display name) is broken up so Discord doesn't read it as one
function defuse(text: string): string {
	return text.replace(/@(everyone|here)/gi, '@​$1');
}

// The message that fires: a ping, the reminder in Botty's words, and a small line when it needs one
export function firedContent(reminder: Reminder, body: string, now = Date.now()): string {
	const ping = reminder.target === 'member' ? `<@${reminder.userId}> ` : reminder.target === 'role' ? `<@&${reminder.roleId}> ` : '@here ';
	const text = defuse(body.trim());
	const notes: string[] = [];
	if (reminder.target !== 'member') {
		notes.push(`Reminder from ${reminder.userName}`);
	}
	if (now - reminder.due > lateAfterMs) {
		notes.push(`due ${stamp(reminder.due, 'R')}`);
	}
	const note = notes.length > 0 ? `\n-# ${defuse(notes.join(', ').replace(/^./, c => c.toUpperCase()))}` : '';
	return `⏰ ${ping}${text}${note}`;
}
