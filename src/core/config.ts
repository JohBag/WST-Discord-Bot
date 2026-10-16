import fs from 'fs';
import { load } from './storage.js';
import merge from './merge.js';
import type { Config, Secrets } from '../types.js';

// config.local.json is git-ignored and holds settings for a local test bot
let config = load<Config>('config');
if (fs.existsSync('config/config.local.json')) {
	config = merge(config, load('config.local'));
}
config.prompt = fs.readFileSync('config/prompt.txt', 'utf8');

const secrets: Secrets = {
	discord: {
		appId: process.env.DISCORD_APP_ID,
		botToken: process.env.DISCORD_BOT_TOKEN,
	},
	keys: {
		gemini: process.env.GEMINI_API_KEY,
		anthropic: process.env.ANTHROPIC_API_KEY,
		warcraftLogs: process.env.WARCRAFT_LOGS_API_KEY,
	}
};

export { config, secrets };
