import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../core/config.js';
import UserError from '../core/user-error.js';
import { openCharacterPanel } from '../features/events/character-panel.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('characters')
		.setDescription('Add, edit or remove the characters you sign up for raids with')
		.setContexts(InteractionContextType.Guild)
		.addUserOption(option =>
			option.setName('member')
				.setDescription("Officers only: manage another member's characters")),
	async execute(interaction: ChatInputCommandInteraction) {
		const member = interaction.options.getUser('member');
		if (!member || member.id === interaction.user.id) {
			return openCharacterPanel(interaction.user.id);
		}
		if (!interaction.inCachedGuild() || !interaction.member.roles.cache.has(config.roles.officer)) {
			throw new UserError("Only officers can manage other members' characters.");
		}
		const target = interaction.options.getMember('member');
		return openCharacterPanel(member.id, target?.displayName ?? member.displayName);
	},
} satisfies BotCommand;
