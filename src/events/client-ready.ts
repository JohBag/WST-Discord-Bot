import log from '../core/log.js';
import { config } from '../core/config.js';
import { startAutoPost } from '../features/warcraft-logs/auto-post.js';
import { syncEmoji } from '../features/events/emoji.js';
import { startEventTimer } from '../features/events/event-actions.js';
import { startReminderTimer } from '../features/reminders/deliver.js';
import type { Client } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'clientReady',
	once: true,
	async execute(client: Client) {
		log('Ready!');

		if (config.warcraftLogs.autoPost) {
			startAutoPost(client);
		}

		// The icons sync in the background, so a slow first upload doesn't hold up the timers
		startEventTimer(client, syncEmoji(client));
		startReminderTimer(client);
	},
} satisfies BotEvent;
