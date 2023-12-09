import log from '../modules/log.js';
import generateResponse from '../modules/generateResponse.js';

export default {
    name: 'messageCreate',
    async execute(interaction) {
        try {
            if (interaction.author.bot) {
                return;
            }

            generateResponse(interaction);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};