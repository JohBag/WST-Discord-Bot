import { SlashCommandBuilder } from 'discord.js';
import textToSpeech from '../common/syntheticSpeech.js';
import getAIResponse from "../common/gpt-3.js";

export default {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask a question to the AI')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        // Get AI response
        const prompt = interaction.options.getString('input');
        const response = await getAIResponse(prompt + "\n");
        if (!response) {
            return interaction.editReply({
                content: 'Error getting response from AI',
            });
        }

        // Convert to synthetic speech
        const file = await textToSpeech(response);

        // Reply to user
        const reply = `*${prompt}*\n${response}\n`;

        interaction.editReply({
            content: reply,
        });
        if (file) {
            interaction.editReply({
                files: [{
                    attachment: file,
                    name: file
                }]
            });
        }
    },
};