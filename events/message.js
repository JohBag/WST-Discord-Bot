import log from '../modules/log.js';
import tryGenerateResponse from '../modules/generateResponse.js';

export default {
	name: 'messageCreate',
	async execute(interaction) {
		try {
			await tryGenerateResponse(interaction);
		} catch (error) {
			log(`Error: ${error}`);
		}
	},
};