import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { secrets } from './modules/data.js';
import * as events from './index/events.js';
import * as commands from './index/commands.js';
import log from './modules/log.js';
import type { BotCommand, BotEvent } from './types.js';

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

function safeHandler(handler: (...args: any[]) => Promise<void>) {
	return async (...args: any[]) => {
		try {
			await handler(...args);
		} catch (error) {
			log.error(`Error in safe handler: ${error}`);
		}
	};
}

for (const event of Object.values(events) as BotEvent[]) {
	const handler = safeHandler(event.execute);

	if (event.once) {
		client.once(event.name, handler);
	} else {
		client.on(event.name, handler);
	}

	log(`Loaded event: ${event.name}`);
}

// Load commands
(client as any).commands = new Collection<string, BotCommand>();
for (const command of Object.values(commands) as BotCommand[]) {
	(client as any).commands.set(command.data.name, command);
	log(`Loaded command: ${command.data.name}`);
}

process.on('unhandledRejection', (reason, promise) => {
	log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
	log.error(`Uncaught Exception: ${error}`);
});

client.login(secrets.discord.botToken).catch(error => {
	log.error(`Failed to login: ${error}`);
});
