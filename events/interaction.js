export default {
    name: 'interactionCreate',
    async execute(interaction) {
        var commandName = "";
        if (interaction.isButton()) {
            commandName = interaction.message.interaction.commandName;
        } else if (interaction.isChatInputCommand()) {
            commandName = interaction.commandName;

            // Log use
            let username = interaction.user.username;
            const nickname = interaction.member.nickname;
            if (nickname != null) {
                username += " (" + nickname + ")";
            }
            console.log(username + " used /" + commandName);
        } else {
            return;
        }

        // Get command
        const command = interaction.client.commands.get(commandName);

        if (!command) {
            console.error(`No command matching ${commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${commandName}`);
            console.error(error);
        }
    },
};