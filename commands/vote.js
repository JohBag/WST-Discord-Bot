import { SlashCommandBuilder } from 'discord.js';
import log from '../modules/log.js';
import { createVote, registerVote } from '../modules/votes.js';

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
		try {
			if (interaction.isButton()) {
				try {
					await registerVote(interaction);
				} catch (error) {
					log(error);
					interaction.reply({ content: "I'm sorry, I had trouble registering your vote.", ephemeral: true });
				}
			} else {
				createVote(interaction);
			}
		} catch (error) {
			log(error);
		}
	},
};
