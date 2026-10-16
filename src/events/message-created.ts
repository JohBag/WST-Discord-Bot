import respond from '../features/chat/respond.js';
import type { Message } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'messageCreate',
	async execute(message: Message) {
		await respond(message);
	},
} satisfies BotEvent;
