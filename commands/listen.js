import { SlashCommandBuilder } from 'discord.js';
import listen from '../modules/listen.js';

export default {
	data: new SlashCommandBuilder()
		.setName('listen')
		.setDescription('Invite the bot to your voice channel'),
	async execute(interaction) {
		await listen(interaction);
	},
};