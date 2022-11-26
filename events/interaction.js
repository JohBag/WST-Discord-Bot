export default {
    name: 'interactionCreate',
    async execute(interaction) {
        var commandName = "";
        if (interaction.isButton()) {
            commandName = interaction.message.interaction.commandName;
        } else if (interaction.isChatInputCommand()) {
            commandName = interaction.commandName;
        } else {
            return;
        }

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