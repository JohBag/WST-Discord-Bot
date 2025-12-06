import log from '../modules/log.js';
import tryGenerateResponse from '../modules/generate-response.js';

export default {
	name: 'messageCreate',
	async execute(interaction) {
		await tryGenerateResponse(interaction);
	},
};