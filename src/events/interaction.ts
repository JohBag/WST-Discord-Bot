import { MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import log from '../core/log.js';
import getUsername from '../core/get-username.js';
import { registerVote } from '../features/votes/votes.js';
import { handlePanelInteraction, panelPrefix } from '../features/music/panel.js';
import { charactersPrefix, handleCharacterInteraction } from '../features/events/character-panel.js';
import UserError from '../core/user-error.js';
import type { BotEvent } from '../types.js';

export default {
	name: 'interactionCreate',
	async execute(interaction: Interaction) {
		if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith(panelPrefix)) {
			await handlePanelInteraction(interaction);
			return;
		}

		if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith(charactersPrefix)) {
			try {
				await handleCharacterInteraction(interaction);
			} catch (error) {
				log.error(`Error in character panel (${interaction.customId}): ${error}`);
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ content: 'Something went wrong with your characters.', flags: MessageFlags.Ephemeral }).catch(() => {});
				}
			}
			return;
		}

		// Vote buttons use the option text as their ID, so they get everything else
		if (interaction.isButton()) {
			await registerVote(interaction);
			return;
		}

		if (!interaction.isChatInputCommand() && !interaction.isUserContextMenuCommand()) {
			return;
		}

		const commandName = interaction.commandName;
		// Slash commands read as /name, right-click commands by their menu name
		const label = interaction.isChatInputCommand() ? `/${commandName}` : commandName;
		const username = await getUsername(interaction);
		log(`${username} used ${label}`);

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
				log(`${label} rejected: ${error.message}`);
			} else {
				log.error(`Error executing ${label}: ${error}`);
			}
			try {
				await interaction.editReply({ content: isUserError ? error.message : `Something went wrong with ${label}.` });
			} catch (replyError) {
				log.error(`Failed to send error reply: ${replyError}`);
			}
		}
	},
} satisfies BotEvent;
