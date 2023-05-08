import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { generateImage } from '../modules/openai.js';

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

        const prompt = interaction.options.getString('prompt');

        if (!await generateImage(prompt)) {
            return interaction.editReply({
                content: 'Error generating image',
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(prompt)
            .setImage('attachment://image.png');

        return interaction.editReply({
            embeds: [embed],
            files: ['./image.png']
        });
    },
};