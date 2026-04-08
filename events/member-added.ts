import log from '../modules/log.js';
import { config } from '../modules/data.js';
import type { GuildMember } from 'discord.js';
import type { BotEvent } from '../types.js';

const newUsersRoleId = config.newUsersRoleId;

export default {
	name: 'guildMemberAdd',
	async execute(member: GuildMember) {
		const role = member.guild.roles.cache.get(newUsersRoleId);
		if (!role) {
			log.warn('New user role not found');
			return;
		}
		await member.roles.add(role);

		log(`Added role ${role.name} to ${member.user.username}`);
	},
} satisfies BotEvent;
