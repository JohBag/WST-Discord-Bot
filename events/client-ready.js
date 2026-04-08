import log from '../modules/log.js';

export default {
	name: 'clientReady',
	once: true,
	async execute(client) {
		log('Ready!');
	},
};