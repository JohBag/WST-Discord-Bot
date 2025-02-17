import log from '../modules/log.js';
import { config } from '../modules/data.js';

const defaultRoleId = config.defaultRoleId;

export default {
    name: 'guildMemberAdd',
    async execute(interaction) {
        try {
            let member = interaction;
            let role = interaction.guild.roles.cache.get(defaultRoleId);
            member.roles.add(role);

            log(`Added role ${role.name} to ${member.user.username}`);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};