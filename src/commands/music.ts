import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { openPanel } from '../features/music/panel.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('music')
		.setDescription('Open the music player'),
	async execute(interaction: ChatInputCommandInteraction) {
		return openPanel(interaction);
	},
} satisfies BotCommand;
