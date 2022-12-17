import { Configuration, OpenAIApi } from "openai";
import { SlashCommandBuilder } from 'discord.js';
import { load } from '../json_manager.js';
import convertToSpeech from '../common/syntheticSpeech.js';

const config = load('config');
const configuration = new Configuration({
    apiKey: config.apiKey,
});
const openai = new OpenAIApi(configuration);

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
        const response = await getOpenAIResponse(prompt + "\n");

        // Convert to synthetic speech
        const file = await convertToSpeech(response);

        // Reply to user
        const msg = "*" + prompt + "*\n" + response + "\n";

        // Add reply
        interaction.editReply({
            content: msg,
        });
        if (file != null) {
            interaction.editReply({
                files: [{
                    attachment: file,
                    name: file
                }]
            });
        }

        return;
    },
};

async function getOpenAIResponse(prompt) {
    const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: 0.6,
        max_tokens: 128
    });

    return completion.data.choices[0].text;;
}