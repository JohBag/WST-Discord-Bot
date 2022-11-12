import { REST, Routes } from 'discord.js';
import config from './config.json' assert { type: "json"};
import * as commands from './index/commands.js'

const commandsData = [];
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const command of Object.values(commands)) {
	commandsData.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(config.token);

// and deploy your commands!

(async () => {
	try {
		console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		// Specific server
		const data = await rest.put(
			Routes.applicationGuildCommands(config.clientId, config.guildId),
			{ body: commandsData },
		);

		// Global
		//const data = await rest.put(
		//    Routes.applicationCommands(config.clientId),
		//    { body: commandsData },
		//);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})(); 