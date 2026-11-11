import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js';
import changeRank from '../features/ranks/change-rank.js';
import UserError from '../core/user-error.js';
import type { Direction } from '../features/ranks/plan.js';
import type { BotCommand } from '../types.js';

const notInServer = "That user isn't in the server.";
const onlyInServer = 'Changing ranks only works in the server.';

// /promote @member and /demote @member
function slashCommand(name: string, description: string, direction: Direction) {
	return {
		data: new SlashCommandBuilder()
			.setName(name)
			.setDescription(description)
			.setContexts(InteractionContextType.Guild)
			.addUserOption(option =>
				option.setName('member')
					.setDescription(`Who to ${name}`)
					.setRequired(true)),
		async execute(interaction: ChatInputCommandInteraction) {
			if (!interaction.inCachedGuild()) {
				throw new UserError(onlyInServer);
			}
			const target = interaction.options.getMember('member');
			if (!target) {
				throw new UserError(notInServer);
			}
			return changeRank(interaction.member, target, direction);
		},
	} satisfies BotCommand;
}

// Right-click a member > Apps > Promote or Demote, the same as the slash commands
function menuCommand(name: string, direction: Direction) {
	return {
		data: new ContextMenuCommandBuilder()
			.setName(name)
			.setType(ApplicationCommandType.User)
			.setContexts(InteractionContextType.Guild),
		async execute(interaction: UserContextMenuCommandInteraction) {
			if (!interaction.inCachedGuild()) {
				throw new UserError(onlyInServer);
			}
			if (!interaction.targetMember) {
				throw new UserError(notInServer);
			}
			return changeRank(interaction.member, interaction.targetMember, direction);
		},
	} satisfies BotCommand<UserContextMenuCommandInteraction>;
}

export const promote = slashCommand('promote', 'Moves a member up one rank: Visitor to Probationer, Probationer to Member. Officers only.', 'up');
export const demote = slashCommand('demote', 'Moves a member down one rank: Member to Probationer, Probationer to Visitor. Officers only.', 'down');
export const promoteMenu = menuCommand('Promote', 'up');
export const demoteMenu = menuCommand('Demote', 'down');
