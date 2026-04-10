import { save, load } from '../modules/json.js';
import log from '../modules/log.js';
import type { Message, PartialMessage } from 'discord.js';
import type { BotEvent, Vote } from '../types.js';

export default {
	name: 'messageDelete',
	async execute(message: Message | PartialMessage) {
		// Check if the message is a vote
		const id = message.id;
		const votes = load<Record<string, Vote>>('votes');
		if (id in votes) {
			// Delete the vote
			delete votes[id];
			save('votes', votes);
			log('Deleted vote: ' + id);
		}
	},
} satisfies BotEvent;
