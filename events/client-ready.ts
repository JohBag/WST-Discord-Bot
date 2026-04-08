import log from '../modules/log.js';
import type { Client } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'clientReady',
	once: true,
	async execute(_client: Client) {
		log('Ready!');
	},
} satisfies BotEvent;
