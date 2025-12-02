import log from '../modules/log.js';

export default {
	name: 'clientReady',
	once: true,
	execute() {
		log('Ready!');
	},
};