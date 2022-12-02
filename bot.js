import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { load } from './json_manager.js';
import * as events from './index/events.js'
import * as commands from './index/commands.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const config = load('config');

// Load events
for (const event of Object.values(events)) {
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Load commands
client.commands = new Collection();
for (const command of Object.values(commands)) {
	client.commands.set(command.data.name, command);
}

client.login(config.token);