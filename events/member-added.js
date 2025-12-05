import log from '../modules/log.js';
import { config } from '../modules/data.js';

const newUsersRoleId = config.newUsersRoleId;

export default {
	name: 'guildMemberAdd',
	async execute(interaction) {
		try {
			let member = interaction;
			let role = interaction.guild.roles.cache.get(newUsersRoleId);
			member.roles.add(role);

			log(`Added role ${role.name} to ${member.user.username}`);
		} catch (error) {
			log(`Error: ${error}`);
		}
	},
};