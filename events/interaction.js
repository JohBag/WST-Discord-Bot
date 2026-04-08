import { MessageFlags } from 'discord.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import { registerVote } from '../modules/votes.js';

export default {
	name: 'interactionCreate',
	async execute(interaction) {
		if (interaction.isButton()) {
			await registerVote(interaction);
			return;
		}

		if (!interaction.isChatInputCommand()) {
			return;
		}

		const commandName = interaction.commandName;
		const username = await getUsername(interaction);
		log(`${username} used /${commandName}`);

		const command = interaction.client.commands.get(commandName);
		if (!command) {
			log(`No command matching ${commandName} was found.`);
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			await command.execute(interaction);
			await interaction.deleteReply();
		} catch (error) {
			log(`Error executing /${commandName}: ${error}`);
			try {
				await interaction.editReply({ content: `Something went wrong with /${commandName}.` });
			} catch (replyError) {
				log(`Failed to send error reply: ${replyError}`);
			}
		}
	},
};