import log from '../modules/log.js';
import { config } from '../modules/data.js';

const defaultRole = config.defaultRole;

export default {
    name: 'guildMemberAdd',
    async execute(interaction) {
        try {
            //let member = interaction;
            
            let roleId = '1340755974176112781';
            let role = interaction.guild.roles.cache.get(roleId);

            let member = interaction.guild.members.cache.get(interaction.id);
            console.log(member);

            //member.edit({ roles: [role] });
            await member.roles.add(role);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};