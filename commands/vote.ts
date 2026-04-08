import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createVote } from '../modules/votes.js';
import type { BotCommand } from '../types.js';

const maxOptions = 5; // Discord limit

export default {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Start a vote')
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('What is the vote about?')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('options')
				.setDescription(`Comma-separated list (max ${maxOptions} options)`)
				.setRequired(true))
		.addBooleanOption(option =>
			option
				.setName('anonymity')
				.setDescription('Hide voter names. Only score is shown (default: false)')),
	async execute(interaction: ChatInputCommandInteraction) {
		const message = await createVote(interaction);
		await message.send(interaction.channel! as any);
	},
} satisfies BotCommand;
