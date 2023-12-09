import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';

export default {
    data: new SlashCommandBuilder()
        .setName('respond')
        .setDescription('Prompt the bot to generate a response'),
    async execute(interaction) {
        try {
            generateResponse(interaction);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};