import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { editVote } from '../modules/votes.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('vote-edit')
		.setDescription('Add new choices to an existing vote')
		.addStringOption(option =>
			option
				.setName('message-id')
				.setDescription('The message ID of the vote to edit')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('options')
				.setDescription('Comma-separated list of new options to add')
				.setRequired(true)),
	async execute(interaction: ChatInputCommandInteraction) {
		const messageId = interaction.options.getString('message-id')!;
		const newOptions = interaction.options.getString('options')!;

		const result = await editVote(interaction, messageId, newOptions);

		if (typeof result === 'string') {
			await interaction.editReply({ content: result });
			return;
		}

		const channel = interaction.channel!;
		const message = await (channel as any).messages.fetch(messageId);
		await message.edit({
			embeds: [result.embed],
			components: result.components,
		});
	},
} satisfies BotCommand;
