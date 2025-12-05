import log from '../modules/log.js';
import listen from '../modules/listen.js';

export default {
	name: 'clientReady',
	once: true,
	execute(client) {
		log('Ready!');
		listen(client);
	},
};