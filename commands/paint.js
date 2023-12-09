import { SlashCommandBuilder } from 'discord.js';
import generateImage from '../modules/generateImage.js';
import log from '../modules/log.js';
import getUsername from '../modules/getUsername.js';

export default {
    data: new SlashCommandBuilder()
        .setName('paint')
        .setDescription('Generate an image')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('A description of the image')
                .setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true }); // Defer to avoid 3 second limit on response

            const prompt = interaction.options.getString('prompt');
            await generateImage(prompt)

            interaction.deleteReply();
            interaction.channel.send({
                files: ['./media/image.png'],
                content: `**${prompt}**, by ${getUsername(interaction)}`
            });
        } catch (error) {
            interaction.editReply({
                content: "I'm sorry, I had trouble generating the image.",
            });
            log(error);
        }
    },
};