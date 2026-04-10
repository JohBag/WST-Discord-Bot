import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import createWarcraftLog from '../modules/warcraft-log.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('log')
		.setDescription('Fetches the Warcraft Logs report')
		.addStringOption(option =>
			option.setName('id')
				.setDescription('The report ID (seen in the URL)')
				.setRequired(true)),
	async execute(interaction: ChatInputCommandInteraction) {
		const id = interaction.options.getString('id')!;
		const message = await createWarcraftLog(interaction as any, id);
		if (message.success) {
			message.send();
		} else {
			throw new Error(message.text);
		}
	},
} satisfies BotCommand;
