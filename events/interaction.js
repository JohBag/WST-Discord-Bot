import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import { registerVote } from '../modules/votes.js';

export default {
	name: 'interactionCreate',
	async execute(interaction) {
		var commandName = '';
		if (interaction.isButton()) {
			await registerVote(interaction);
			return;
		} else if (interaction.isChatInputCommand()) {
			commandName = interaction.commandName;
		} else {
			return;
		}

		const username = await getUsername(interaction);
		log(`${username} used /${commandName}`);

		// Get command
		const command = interaction.client.commands.get(commandName);
		if (!command) {
			log(`No command matching ${commandName} was found.`);
			return;
		}

		await command.execute(interaction);
	},
};