import { MessageFlags } from 'discord.js';
import type { Interaction, RepliableInteraction } from 'discord.js';
import log from '../core/log.js';
import getUsername from '../core/get-username.js';
import { registerVote } from '../features/votes/votes.js';
import { handlePanelInteraction, panelPrefix } from '../features/music/panel.js';
import { charactersPrefix, handleCharacterInteraction } from '../features/events/character-panel.js';
import { handleEventInteraction } from '../features/events/event-actions.js';
import { eventPrefix } from '../features/events/post.js';
import { handleReminderInteraction, remindersPrefix } from '../features/reminders/actions.js';
import UserError from '../core/user-error.js';
import type { BotEvent } from '../types.js';

// Answers a failed interaction: a new private reply, or the one already started
async function replyError(interaction: RepliableInteraction, content: string): Promise<void> {
	try {
		if (interaction.deferred) {
			await interaction.editReply({ content, components: [] });
		} else if (!interaction.replied) {
			await interaction.reply({ content, flags: MessageFlags.Ephemeral });
		}
	} catch (error) {
		log.error(`Failed to send error reply: ${error}`);
	}
}

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
				await replyError(interaction, 'Something went wrong with your characters.');
			}
			return;
		}

		if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith(eventPrefix)) {
			try {
				await handleEventInteraction(interaction);
			} catch (error) {
				log.error(`Error in event sign-ups (${interaction.customId}): ${error}`);
				await replyError(interaction, 'Something went wrong with that event.');
			}
			return;
		}

		if (interaction.isStringSelectMenu() && interaction.customId.startsWith(remindersPrefix)) {
			try {
				await handleReminderInteraction(interaction);
			} catch (error) {
				log.error(`Error in reminders (${interaction.customId}): ${error}`);
				await replyError(interaction, 'Something went wrong with that reminder.');
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
		const command = interaction.client.commands.get(commandName);

		// A command that opens a form has 3 seconds to do it, so it doesn't wait for the name lookup
		if (command?.defer === false) {
			log(`${interaction.user.username} used ${label}`);
			try {
				await command.execute(interaction);
			} catch (error) {
				log.error(`Error executing ${label}: ${error}`);
				await replyError(interaction, `Something went wrong with ${label}.`);
			}
			return;
		}

		const username = await getUsername(interaction);
		log(`${username} used ${label}`);
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
