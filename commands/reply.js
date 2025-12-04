import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';
import tryGenerateResponse from '../modules/generate-response.js';

export default {
	data: new SlashCommandBuilder()
		.setName('reply')
		.setDescription('Prompt the bot to generate a response'),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });
			await tryGenerateResponse(interaction);
			interaction.deleteReply();
		} catch (error) {
			log(`Error: ${error}`);
			interaction.editReply({
				content: "I'm sorry, I had trouble generating a response.",
			});
		}
	},
};