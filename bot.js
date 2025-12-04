import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { secrets } from './modules/data.js';
import * as events from './index/events.js'
import * as commands from './index/commands.js'
import log from './modules/log.js';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates
	]
});

for (const event of Object.values(events)) {
	if (event.once) {
		client.once(event.name, event.execute);
	} else {
		client.on(event.name, event.execute);
	}

	log(`Loaded event: ${event.name}`);
}

// Load commands
client.commands = new Collection();
for (const command of Object.values(commands)) {
	client.commands.set(command.data.name, command);
	log(`Loaded command: ${command.data.name}`);
}

client.login(secrets.discord.token);
