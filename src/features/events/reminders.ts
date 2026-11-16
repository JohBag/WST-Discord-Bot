import type { Client } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import { loadEvents, saveEvents } from './store.js';
import type { RaidEvent } from './store.js';

// An hour before the start, a reply to the post pings everyone signed up, Late or Tentative
// (decided 2026-11-15: one channel message, no direct messages)

const defaultMinutes = 60;

export function reminderMinutes(): number {
	return config.events?.reminderMinutes ?? defaultMinutes;
}

// Due once the reminder time has come and until the start. An event posted after its reminder time
// gets none: everyone on it has only just answered
export function reminderDue(event: RaidEvent, now = Date.now()): boolean {
	const at = event.start - reminderMinutes() * 60 * 1000;
	return !event.cancelled && !event.reminded && !!event.messageId && now >= at && now < event.start && event.createdAt < at;
}

export function reminderPings(event: RaidEvent): string[] {
	return event.signups
		.filter(s => s.status === 'signed' || s.status === 'late' || s.status === 'tentative')
		.sort((a, b) => a.number - b.number)
		.map(s => s.userId);
}

export function reminderText(event: RaidEvent, pings: string[]): string {
	const line = `**${event.title}** starts <t:${Math.floor(event.start / 1000)}:R>.`;
	return pings.length > 0 ? [line, pings.map(id => `<@${id}>`).join(' ')].join('\n') : line;
}

// A message may mention at most 100 people and hold 2000 characters, so a big event's pings go in
// several. The first says what it's about. With nobody signed up it still goes out, without pings,
// so the channel gets the heads-up
export function reminderMessages(event: RaidEvent, pings: string[]): { content: string; users: string[] }[] {
	if (pings.length === 0) {
		return [{ content: reminderText(event, []), users: [] }];
	}
	const perMessage = 60;
	const messages = [];
	for (let i = 0; i < pings.length; i += perMessage) {
		const users = pings.slice(i, i + perMessage);
		messages.push({ content: i === 0 ? reminderText(event, users) : users.map(id => `<@${id}>`).join(' '), users });
	}
	return messages;
}

export async function sendReminders(client: Client, now = Date.now()): Promise<void> {
	for (const id of Object.keys(loadEvents())) {
		const event = loadEvents()[id];
		if (!event || !reminderDue(event, now)) {
			continue;
		}
		// Marked first, so a failed send isn't tried again every minute
		const store = loadEvents();
		store[id].reminded = true;
		saveEvents(store);
		const pings = reminderPings(event);
		try {
			const channel = await client.channels.fetch(event.channelId);
			if (channel?.isSendable()) {
				for (const [i, message] of reminderMessages(event, pings).entries()) {
					await channel.send({
						content: message.content,
						reply: i === 0 ? { messageReference: event.messageId!, failIfNotExists: false } : undefined,
						allowedMentions: { users: message.users },
					});
				}
				log(`Reminded ${pings.length} about ${event.title}`);
			}
		} catch (error) {
			log.error(`Reminder for ${event.title} failed: ${error}`);
		}
	}
}
