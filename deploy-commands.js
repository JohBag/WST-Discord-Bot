import { REST, Routes } from 'discord.js';
import { load } from './json_manager.js';
import * as commands from './index/commands.js'

const config = load('config');
const mode = process.argv[2] ?? 'global'

const commandsData = [];
for (const command of Object.values(commands)) {
	commandsData.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
	try {
		console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

		let data;
		if (mode == 'global') {
			console.log("Deploying commands globally");
			data = await rest.put(
				Routes.applicationCommands(config.clientId),
				{ body: commandsData },
			);
		} else { // Test server
			console.log("Deploying commands locally");
			data = await rest.put(
				Routes.applicationGuildCommands(config.clientId, config.guildId),
				{ body: commandsData },
			);
		}

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})(); 