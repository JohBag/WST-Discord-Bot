import type { GuildScheduledEvent, PartialGuildScheduledEvent, User } from 'discord.js';
import { onInterested, onNotInterested } from '../features/events/interest.js';
import type { BotEvent } from '../types.js';

// A member clicks or unclicks Interested on an entry in the server's Events tab
export const interested = {
	name: 'guildScheduledEventUserAdd',
	async execute(entry: GuildScheduledEvent | PartialGuildScheduledEvent, user: User) {
		await onInterested(entry, user);
	},
} satisfies BotEvent;

export const notInterested = {
	name: 'guildScheduledEventUserRemove',
	async execute(entry: GuildScheduledEvent | PartialGuildScheduledEvent, user: User) {
		await onNotInterested(entry, user);
	},
} satisfies BotEvent;
