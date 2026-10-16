import { REST, Routes } from 'discord.js';
import { secrets } from './core/config.js';

const rest = new REST({ version: '10' }).setToken(secrets.discord.botToken!);

// for global commands
rest.put(Routes.applicationCommands(secrets.discord.appId!), { body: [] })
	.then(() => console.log('Successfully deleted all application commands.'))
	.catch(console.error);
