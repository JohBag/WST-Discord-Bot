import { SlashCommandBuilder } from 'discord.js';
import textToSpeech from '../modules/textToSpeech.js';
import { models, generateResponse } from '../modules/openai.js';
import { load } from '../modules/jsonHandler.js';

const config = load('config');

export default {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Answer a question with GPT-4')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('Your question')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        // Get question
        const question = interaction.options.getString('input');

        // Get answer
        const response = await generateResponse(
            config.prompts.ask,
            [{ role: 'user', content: question }],
            models.GPT4
        );
        if (!response) {
            return interaction.editReply({ content: 'Error: No response. Try again later.', ephemeral: true });
        }

        // Send response
        let msg = { content: `*${question}*\n\n${response}\n`, files: [] };

        const speechFile = await textToSpeech(response);
        if (speechFile) {
            msg.files.push({
                attachment: speechFile,
                name: speechFile
            });
        }

        interaction.editReply(msg);
    },
};