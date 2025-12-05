import { SlashCommandBuilder } from 'discord.js';
import tryGenerateResponse from '../modules/generate-response.js';

export default {
	data: new SlashCommandBuilder()
		.setName('reply')
		.setDescription('Generate a response'),
	async execute(interaction) {
		await tryGenerateResponse(interaction);
	},
};