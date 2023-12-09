import log from '../modules/log.js';
import { getUserName } from '../modules/getUserName.js';

export default {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            var commandName = '';
            if (interaction.isButton()) {
                commandName = interaction.message.interaction.commandName;
            } else if (interaction.isChatInputCommand()) {
                commandName = interaction.commandName;

                // Log use
                let username = getUserName(interaction);
                const nickname = interaction.member.nickname;
                if (nickname) {
                    username += ` (${nickname})`;
                }
                log(`${username} used /${commandName}`);
            } else {
                return;
            }

            // Get command
            const command = interaction.client.commands.get(commandName);

            if (!command) {
                throw new Error(`No command matching ${commandName} was found.`);
            }

            await command.execute(interaction);
        } catch (error) {
            log(`Error: ${error}`);
        }
    },
};