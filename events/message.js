import log from '../modules/log.js';
import generateResponse from '../modules/generateResponse.js';

export default {
    name: 'messageCreate',
    async execute(interaction) {
        try {
            await generateResponse(interaction);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};