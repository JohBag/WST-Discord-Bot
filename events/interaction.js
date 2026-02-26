import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import { registerVote } from '../modules/votes.js';
import { MessageFlags } from 'discord.js';

export default {
	name: 'interactionCreate',
	async execute(interaction) {
		var commandName = '';
		if (interaction.isButton()) {
			await registerVote(interaction);
			return;
		} else if (interaction.isChatInputCommand()) {
			commandName = interaction.commandName;

			// Log use
			const username = await getUsername(interaction);
			log(`${username} used /${commandName}`);
		} else {
			return;
		}

		// Get command
		const command = interaction.client.commands.get(commandName);
		if (!command) {
			log(`No command matching ${commandName} was found.`);
			return;
		}

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			await command.execute(interaction);
			await interaction.deleteReply();
		} catch (error) {
			log(`Error: ${error}`);
			if (!interaction.deferred) {
				await interaction.reply({ content: "I'm sorry, I encountered an error while processing your interaction.", flags: MessageFlags.Ephemeral });
			} else {
				await interaction.editReply({ content: "I'm sorry, I encountered an error while processing your interaction." });
			}
		}
	},
};