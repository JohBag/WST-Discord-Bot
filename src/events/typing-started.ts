import { startedTyping } from '../features/chat/typing.js';
import type { Typing } from 'discord.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'typingStart',
	async execute(typing: Typing) {
		if (!typing.user.bot) {
			startedTyping(typing.channel.id, typing.user.id);
		}
	},
} satisfies BotEvent;
