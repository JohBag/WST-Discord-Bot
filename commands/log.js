import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';
import createWarcraftLog from '../modules/warcraft-log.js';

export default {
	data: new SlashCommandBuilder()
		.setName('log')
		.setDescription('Fetches the Warcraft Logs report')
		.addStringOption(option =>
			option.setName('id')
				.setDescription('The report ID (seen in the URL)')
				.setRequired(true)),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true }); // Defer to avoid 3 second limit on response

			const message = await createWarcraftLog(id);

			interaction.deleteReply();
			interaction.channel.send({ embeds: [log] });
		} catch (error) {
			interaction.editReply({
				content: "I'm sorry, I had trouble fetching the log.",
			});
			log(error);
		}
	},
};