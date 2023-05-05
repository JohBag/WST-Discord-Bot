import { SlashCommandBuilder } from 'discord.js';
import textToSpeech from '../common/textToSpeech.js';
import getAIResponse from "../common/gpt.js";

export default {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Answer a question with GPT-4')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        // Get question
        const question = interaction.options.getString('input');

        // Get answer
        const response = await getAIResponse(
            "Write in a concise and informative style.",
            [{ role: "user", content: question }],
            true
        );
        if (!response) {
            return interaction.editReply({ content: 'Error: No response. Try again later.', ephemeral: true });
        }

        // Send response
        let msg = { content: `*${question}*\n\n${response}\n`, files: [] };

        const speechFile = await textToSpeech(response);
        if (speechFile != null) {
            msg.files.push({
                attachment: speechFile,
                name: speechFile
            });
        }

        interaction.editReply(msg);
    },
};