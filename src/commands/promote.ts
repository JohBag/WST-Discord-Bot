import { SlashCommandBuilder, ChatInputCommandInteraction, InteractionContextType } from 'discord.js';
import promote from '../features/ranks/promote.js';
import UserError from '../core/user-error.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('promote')
		.setDescription('Moves a member up one rank: Visitor to Probationer, Probationer to Member. Officers only.')
		.setContexts(InteractionContextType.Guild)
		.addUserOption(option =>
			option.setName('member')
				.setDescription('Who to promote')
				.setRequired(true)),
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			throw new UserError('Promoting only works in the server.');
		}
		const target = interaction.options.getMember('member');
		if (!target) {
			throw new UserError("That user isn't in the server.");
		}
		return promote(interaction.member, target);
	},
} satisfies BotCommand;
