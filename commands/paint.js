import { Configuration, OpenAIApi } from "openai";
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { load } from '../json_manager.js';

const config = load('config');

export default {
    data: new SlashCommandBuilder()
        .setName('paint')
        .setDescription('Generate an image')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('A description of the image')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        const prompt = toTitleCase(interaction.options.getString('prompt'));

        const configuration = new Configuration({
            apiKey: config.apiKey,
        });
        const openai = new OpenAIApi(configuration);
        const response = await openai.createImage({
            prompt: prompt,
            n: 1,
            size: "256x256",
        });
        const imageUrl = response.data.data[0].url;

        const embed = new EmbedBuilder()
            .setTitle(prompt)
            .setImage(imageUrl);

        return interaction.editReply({
            embeds: [embed]
        });
    },
};

function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}