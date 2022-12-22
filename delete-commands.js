import { REST, Routes } from 'discord.js';
import { load } from './json_manager.js';

const config = load('config');
const rest = new REST({ version: '10' }).setToken(config.token);

// for global commands
rest.put(Routes.applicationCommands(config.clientId), { body: [] })
    .then(() => console.log('Successfully deleted all application commands.'))
    .catch(console.error);