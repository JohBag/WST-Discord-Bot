import tryGenerateResponse from '../modules/generate-response.js';
import type { Message } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'messageCreate',
	async execute(message: Message) {
		await tryGenerateResponse(message);
	},
} satisfies BotEvent;
