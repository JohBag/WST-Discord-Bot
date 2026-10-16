import { MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import log from '../core/log.js';
import getUsername from '../core/get-username.js';
import { registerVote } from '../features/votes/votes.js';
import { handlePanelInteraction, panelPrefix } from '../features/music/panel.js';
import UserError from '../core/user-error.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'interactionCreate',
	async execute(interaction: Interaction) {
		if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith(panelPrefix)) {
			await handlePanelInteraction(interaction);
			return;
		}

		// Vote buttons use the option text as their ID, so they get everything else
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
			log.warn(`No command matching ${commandName} was found.`);
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const reply = await command.execute(interaction);
			if (reply) {
				await interaction.editReply(typeof reply === 'string' ? { content: reply } : reply);
			} else {
				await interaction.deleteReply();
			}
		} catch (error) {
			const isUserError = error instanceof UserError;
			if (isUserError) {
				log(`/${commandName} rejected: ${error.message}`);
			} else {
				log.error(`Error executing /${commandName}: ${error}`);
			}
			try {
				await interaction.editReply({ content: isUserError ? error.message : `Something went wrong with /${commandName}.` });
			} catch (replyError) {
				log.error(`Failed to send error reply: ${replyError}`);
			}
		}
	},
} satisfies BotEvent;
