import log from '../modules/log.js';
import listen from '../modules/listen.js';
import { config } from '../modules/data.js';

export default {
	name: 'clientReady',
	once: true,
	async execute(client) {
		log('Ready!');

		if (config.voiceChat.defaultChannelId) {
			await listen(client);
		}
	},
};