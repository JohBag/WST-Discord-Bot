import { SlashCommandBuilder } from 'discord.js';
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
		const id = interaction.options.getString('id');
		const message = await createWarcraftLog(interaction, id);
		if (message.success) {
			message.send();
		} else {
			interaction.editReply({
				content: message.text,
			});
		}
	},
};