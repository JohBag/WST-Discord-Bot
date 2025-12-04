import { REST, Routes } from 'discord.js';
import { secrets } from './modules/data.js';
import * as commands from './index/commands.js'

const commandsData = [];
for (const command of Object.values(commands)) {
	commandsData.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(secrets.discord.token);

(async () => {
	try {
		console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

		let data;
		console.log('Deploying commands globally');
		data = await rest.put(
			Routes.applicationCommands(secrets.discord.clientId),
			{ body: commandsData },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})(); 