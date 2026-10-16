import log from '../core/log.js';
import { config } from '../core/config.js';
import { startAutoPost } from '../features/warcraft-logs/auto-post.js';
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
	},
} satisfies BotEvent;
