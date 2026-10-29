import respond from '../features/chat/respond.js';
import { sentMessage } from '../features/chat/typing.js';
import type { Message } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'messageCreate',
	async execute(message: Message) {
		sentMessage(message.channelId, message.author.id);
		await respond(message);
	},
} satisfies BotEvent;
