import { REST, Routes } from 'discord.js';
import { secrets } from './modules/data.js';
import * as commands from './index/commands.js';
import type { BotCommand } from './types.js';

const commandsData = [];
for (const command of Object.values(commands) as BotCommand[]) {
	commandsData.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(secrets.discord.botToken!);

(async () => {
	try {
		console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

		console.log('Deploying commands globally');
		const data = await rest.put(
			Routes.applicationCommands(secrets.discord.appId!),
			{ body: commandsData },
		) as unknown[];

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();
