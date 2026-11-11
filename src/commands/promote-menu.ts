import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType } from 'discord.js';
import type { UserContextMenuCommandInteraction } from 'discord.js';
import promote from '../features/ranks/promote.js';
import UserError from '../core/user-error.js';
import type { BotCommand } from '../types.js';

// Right-click a member > Apps > Promote, the same as /promote
export default {
	data: new ContextMenuCommandBuilder()
		.setName('Promote')
		.setType(ApplicationCommandType.User)
		.setContexts(InteractionContextType.Guild),
	async execute(interaction: UserContextMenuCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			throw new UserError('Promoting only works in the server.');
		}
		if (!interaction.targetMember) {
			throw new UserError("That user isn't in the server.");
		}
		return promote(interaction.member, interaction.targetMember);
	},
} satisfies BotCommand<UserContextMenuCommandInteraction>;
