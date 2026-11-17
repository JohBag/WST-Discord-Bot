import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js';
import UserError from '../core/user-error.js';
import { isOfficerMember, listView, setReminder } from '../features/reminders/actions.js';
import { confirmation } from '../features/reminders/format.js';
import { maxTextLength } from '../features/reminders/store.js';
import type { ReminderTarget } from '../features/reminders/store.js';
import type { BotCommand } from '../types.js';

function withWhenAndWhat(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
	return sub
		.addStringOption(option => option
			.setName('when')
			.setDescription('In 2h, 1d 3h or 30m, or at 19:30 or Fri 19:30 (server time)')
			.setRequired(true))
		.addStringOption(option => option
			.setName('what')
			.setDescription('What to remind about')
			.setMaxLength(maxTextLength)
			.setRequired(true));
}

export default {
	data: new SlashCommandBuilder()
		.setName('remind')
		.setDescription('Set a reminder, or see and cancel yours')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub => withWhenAndWhat(sub
			.setName('me')
			.setDescription('Remind yourself, with a ping in this channel')))
		.addSubcommand(sub => withWhenAndWhat(sub
			.setName('channel')
			.setDescription('Remind everyone in this channel, without a ping. Officers only.')))
		.addSubcommand(sub => withWhenAndWhat(sub
			.setName('role')
			.setDescription('Remind a role, with a ping in this channel. Officers only.')
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role to ping')
				.setRequired(true))))
		.addSubcommand(sub => sub
			.setName('list')
			.setDescription('See your reminders and this channel\'s, and cancel them')),
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			throw new UserError('Reminders only work in the server.');
		}
		const isOfficer = isOfficerMember(interaction.member);
		const sub = interaction.options.getSubcommand();
		if (sub === 'list') {
			return listView(interaction.user.id, interaction.channelId, isOfficer);
		}
		const reminder = setReminder({
			target: sub as ReminderTarget,
			when: interaction.options.getString('when', true),
			text: interaction.options.getString('what', true),
			role: interaction.options.getRole('role') ?? undefined,
			userId: interaction.user.id,
			userName: interaction.member.displayName,
			guild: interaction.guild,
			channelId: interaction.channelId,
			isOfficer,
		});
		return confirmation(reminder);
	},
} satisfies BotCommand;
