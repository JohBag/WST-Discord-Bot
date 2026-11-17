import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import UserError from '../core/user-error.js';
import { isOfficerMember, listView, setReminder } from '../features/reminders/actions.js';
import { confirmationCard } from '../features/reminders/format.js';
import { maxTextLength } from '../features/reminders/store.js';
import type { ReminderTarget } from '../features/reminders/store.js';
import type { BotCommand } from '../types.js';

function guildOnly(interaction: ChatInputCommandInteraction): asserts interaction is ChatInputCommandInteraction<'cached'> {
	if (!interaction.inCachedGuild()) {
		throw new UserError('Reminders only work in the server.');
	}
}

export const remind = {
	data: new SlashCommandBuilder()
		.setName('remind')
		.setDescription('Set a reminder, posted in this channel when it\'s due')
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option => option
			.setName('when')
			.setDescription('In 2h, 1d 3h or 30m, or at 19:30 or Fri 19:30 (server time)')
			.setRequired(true))
		.addStringOption(option => option
			.setName('what')
			.setDescription('What to remind about')
			.setMaxLength(maxTextLength)
			.setRequired(true))
		.addStringOption(option => option
			.setName('for')
			.setDescription('Who it\'s for. Default: you, with a ping')
			.addChoices({ name: 'Me', value: 'member' }, { name: 'This channel (officers)', value: 'channel' }))
		.addRoleOption(option => option
			.setName('role')
			.setDescription('Ping a role instead (officers)')),
	async execute(interaction: ChatInputCommandInteraction) {
		guildOnly(interaction);
		const role = interaction.options.getRole('role') ?? undefined;
		const chosen = interaction.options.getString('for') as ReminderTarget | null;
		if (role && chosen) {
			throw new UserError('Pick who it\'s for or a role, not both.');
		}
		const target: ReminderTarget = role ? 'role' : chosen ?? 'member';
		const reminder = setReminder({
			target,
			when: interaction.options.getString('when', true),
			text: interaction.options.getString('what', true),
			role,
			userId: interaction.user.id,
			userName: interaction.member.displayName,
			guild: interaction.guild,
			channelId: interaction.channelId,
			isOfficer: isOfficerMember(interaction.member),
		});
		return { embeds: [confirmationCard(reminder)] };
	},
} satisfies BotCommand;

export const reminders = {
	data: new SlashCommandBuilder()
		.setName('reminders')
		.setDescription('See your reminders and this channel\'s, and cancel them')
		.setContexts(InteractionContextType.Guild),
	async execute(interaction: ChatInputCommandInteraction) {
		guildOnly(interaction);
		return listView(interaction.user.id, interaction.channelId, isOfficerMember(interaction.member));
	},
} satisfies BotCommand;
