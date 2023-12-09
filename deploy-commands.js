import { REST, Routes } from 'discord.js';
import { load } from './modules/jsonHandler.js';
import * as commands from './index/commands.js'

const secrets = load('secrets');

const commandsData = [];
for (const command of Object.values(commands)) {
	commandsData.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(secrets.token);

(async () => {
	try {
		console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

		let data;
		console.log('Deploying commands globally');
		data = await rest.put(
			Routes.applicationCommands(secrets.clientId),
			{ body: commandsData },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})(); 