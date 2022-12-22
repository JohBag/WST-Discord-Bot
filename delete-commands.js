import { REST, Routes } from 'discord.js';
import { load } from './json_manager.js';

const secrets = load('secrets');
const rest = new REST({ version: '10' }).setToken(secrets.token);

// for global commands
rest.put(Routes.applicationCommands(secrets.clientId), { body: [] })
    .then(() => console.log('Successfully deleted all application commands.'))
    .catch(console.error);