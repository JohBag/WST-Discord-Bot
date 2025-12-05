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

function safeHandler(handler) {
	return async (...args) => {
		try {
			await handler(...args);
		} catch (error) {
			log(`Error in safe handler: ${error}`);
		}
	};
}

for (const event of Object.values(events)) {
	const handler = safeHandler(event.execute);

	if (event.once) {
		client.once(event.name, handler);
	} else {
		client.on(event.name, handler);
	}

	log(`Loaded event: ${event.name}`);
}

// Load commands
client.commands = new Collection();
for (const command of Object.values(commands)) {
	const handler = safeHandler(command.execute);
	client.commands.set(command.data.name, handler);
	log(`Loaded command: ${command.data.name}`);
}

client.login(secrets.discord.botToken);
