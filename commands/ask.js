import { SlashCommandBuilder } from 'discord.js';
import convertToSpeech from '../common/syntheticSpeech.js';
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

        // Convert to synthetic speech
        const file = await convertToSpeech(response);

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