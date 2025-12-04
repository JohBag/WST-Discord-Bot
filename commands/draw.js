import { SlashCommandBuilder } from 'discord.js';
import { generateImage } from '../modules/gemini.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import { config } from '../modules/data.js';

export default {
	data: new SlashCommandBuilder()
		.setName('draw')
		.setDescription('Generate an image')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('Describe the image you want to generate')
				.setRequired(true)),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true }); // Defer to avoid 3 second limit on response

			const prompt = interaction.options.getString('prompt');
			await generateImage(prompt);

			const username = await getUsername(interaction);

			interaction.deleteReply();
			interaction.channel.send({
				files: [config.imageFile],
				content: `**${prompt}**, by ${username}`
			});
		} catch (error) {
			interaction.editReply({
				content: "I'm sorry, I couldn't generate the image.",
			});
			log(error);
		}
	},
};