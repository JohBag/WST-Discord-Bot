import type { Reminder } from './store.js';

// The text of confirmations, lists and the reminder itself

const lateAfterMs = 2 * 60 * 1000;
// Lines in the list are cut so ten long reminders still fit one Discord message, with room left
// for the headings and a line saying what was just cancelled
const listTextLength = 80;
const maxListLength = 1700;

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

// "Reminder #12 set for <date> (in 2 hours): bring flasks", the date in each reader's own time
// In chat, a member's reminder names them, since several people may have asked at once
export function confirmation(reminder: Reminder, inChat = false): string {
	const who = reminder.target === 'role' ? ` for <@&${reminder.roleId}>`
		: reminder.target === 'channel' ? ' for this channel'
		: inChat ? ` for ${reminder.userName}` : '';
	return `⏰ Reminder #${reminder.number}${who} set for ${stamp(reminder.due, 'F')} (${stamp(reminder.due, 'R')}): ${reminder.text}`;
}

export function listLine(reminder: Reminder, channelId: string): string {
	return `\`#${reminder.number}\` ${stamp(reminder.due, 'f')} (${stamp(reminder.due, 'R')}) ${forWhom(reminder, channelId)}${shorten(reminder.text, listTextLength)}`;
}

export function listText(own: Reminder[], channel: Reminder[], channelId: string, empty = 'No reminders set. Set one with /remind me, or ask me in chat.'): string {
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

// The message that fires: a ping, the reminder in Botty's words, and a small line when it needs one
export function firedContent(reminder: Reminder, body: string, now = Date.now()): string {
	const ping = reminder.target === 'member' ? `<@${reminder.userId}> ` : reminder.target === 'role' ? `<@&${reminder.roleId}> ` : '';
	const notes: string[] = [];
	if (reminder.target !== 'member') {
		notes.push(`Reminder from ${reminder.userName}`);
	}
	if (now - reminder.due > lateAfterMs) {
		notes.push(`due ${stamp(reminder.due, 'R')}`);
	}
	const note = notes.length > 0 ? `\n-# ${notes.join(', ').replace(/^./, c => c.toUpperCase())}` : '';
	return `⏰ ${ping}${body.trim()}${note}`;
}
