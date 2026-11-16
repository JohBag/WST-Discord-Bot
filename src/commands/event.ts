import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { openCreateForm } from '../features/events/event-actions.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('event')
		.setDescription('Raid and event sign-ups')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub => sub
			.setName('create')
			.setDescription('Post a raid or event for sign-ups. Officers only.')
			.addStringOption(option => option
				.setName('game')
				.setDescription('Which game')
				.setRequired(true)
				.addChoices({ name: 'Retail', value: 'retail' }, { name: 'Forever', value: 'forever' }))
			.addStringOption(option => option
				.setName('type')
				.setDescription('A raid signs up characters by role. An event is a plain attending list. Default: raid')
				.addChoices({ name: 'Raid', value: 'raid' }, { name: 'Event', value: 'event' }))),
	// Opens a form, which has to be the first reply
	defer: false,
	async execute(interaction: ChatInputCommandInteraction) {
		await openCreateForm(interaction);
	},
} satisfies BotCommand;
