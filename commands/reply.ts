import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import tryGenerateResponse from '../modules/generate-response.js';
import type { BotCommand } from '../types.js';

export default {
	data: new SlashCommandBuilder()
		.setName('reply')
		.setDescription('Generate a response'),
	async execute(interaction: ChatInputCommandInteraction) {
		await tryGenerateResponse(interaction);
	},
} satisfies BotCommand;
