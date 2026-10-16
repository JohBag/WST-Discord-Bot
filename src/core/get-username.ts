import log from './log.js';
import type { Message, ChatInputCommandInteraction, ButtonInteraction, User } from 'discord.js';

type InteractionLike = Message | ChatInputCommandInteraction | ButtonInteraction;

export default async function getUsername(interaction: InteractionLike): Promise<string> {
	let name = "Unknown user";
	try {
		const user: User = 'author' in interaction && interaction.author ? interaction.author : (interaction as ChatInputCommandInteraction | ButtonInteraction).user;
		const member = await interaction.guild!.members.fetch(user.id);
		name = member.displayName || user.displayName || name;
	} catch (error) {
		log.error(`Error: ${error}`);
	} finally {
		return name;
	}
}
