import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';
import listen from '../modules/listen.js';

export default {
	data: new SlashCommandBuilder()
		.setName('listen')
		.setDescription('Invite the bot to your voice channel'),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });
			await listen(interaction);
			interaction.deleteReply();
		} catch (error) {
			log(`Error: ${error}`);
			interaction.editReply({
				content: "I'm sorry, I couldn't join your voice channel.",
			});
		}
	},
};