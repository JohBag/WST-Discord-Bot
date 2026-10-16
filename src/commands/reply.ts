import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import respond from '../features/chat/respond.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('reply')
		.setDescription('Generate a response'),
	async execute(interaction: ChatInputCommandInteraction) {
		await respond(interaction);
	},
} satisfies BotCommand;
