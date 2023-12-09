import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';
import generateResponse from '../modules/generateResponse.js';

export default {
    data: new SlashCommandBuilder()
        .setName('respond')
        .setDescription('Prompt the bot to generate a response'),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            await generateResponse(interaction);
            interaction.deleteReply();
        } catch (error) {
            log(`Error: ${error}`);
            interaction.editReply({
                content: "I'm sorry, I had trouble generating a response.",
            });
        }
    },
};