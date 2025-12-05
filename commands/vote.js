import { SlashCommandBuilder } from 'discord.js';
import { createVote } from '../modules/votes.js';

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
	async execute(interaction) {
		const message = await createVote(interaction);
		if (message.success) {
			message.send(interaction.channel);
		} else {
			throw new Error(message.text);
		}
	},
};
