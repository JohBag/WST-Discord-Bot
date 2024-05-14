import { REST, Routes } from 'discord.js';
import { secrets } from './modules/data.js';

const rest = new REST({ version: '10' }).setToken(secrets.token);

// for global commands
rest.put(Routes.applicationCommands(secrets.clientId), { body: [] })
    .then(() => console.log('Successfully deleted all application commands.'))
    .catch(console.error);