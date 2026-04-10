import { MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import { registerVote } from '../modules/votes.js';
import type { BotCommand, BotEvent } from '../types.js';

export default {
	name: 'interactionCreate',
	async execute(interaction: Interaction) {
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

		const commands = (interaction.client as any).commands;
		const command = commands.get(commandName) as BotCommand | undefined;
		if (!command) {
			log.warn(`No command matching ${commandName} was found.`);
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			await command.execute(interaction);
			await interaction.deleteReply();
		} catch (error) {
			log.error(`Error executing /${commandName}: ${error}`);
			try {
				await interaction.editReply({ content: `Something went wrong with /${commandName}.` });
			} catch (replyError) {
				log.error(`Failed to send error reply: ${replyError}`);
			}
		}
	},
} satisfies BotEvent;
