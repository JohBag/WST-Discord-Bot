import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';

export default {
	name: 'interactionCreate',
	async execute(interaction) {
		try {
			var commandName = '';
			if (interaction.isButton()) {
				commandName = "vote"; // TODO: Identify button parent type without commandName
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
				await interaction.deferReply({ ephemeral: true });
				await command.execute(interaction);
				await interaction.deleteReply();
			} catch (error) {
				log(`Error: ${error}`);
				await interaction.editReply({ content: "I'm sorry, I encountered an error while processing your interaction." });
			}
		} catch (error) {
			log(`Error: ${error}`);
		}
	},
};