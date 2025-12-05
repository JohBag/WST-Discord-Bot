import log from '../modules/log.js';
import listen from '../modules/listen.js';

export default {
	name: 'clientReady',
	once: true,
	async execute(client) {
		log('Ready!');
		await listen(client);
	},
};