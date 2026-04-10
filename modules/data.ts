import fs from 'fs';
import { load } from './json.js';
import type { Config, Secrets } from '../types.js';

const config = load<Config>('config');
config.prompt = fs.readFileSync('config/prompt.txt', 'utf8');

const secrets: Secrets = {
	discord: {
		appId: process.env.DISCORD_APP_ID,
		botToken: process.env.DISCORD_BOT_TOKEN,
	},
	keys: {
		gemini: process.env.GEMINI_API_KEY,
		warcraftLogs: process.env.WARCRAFT_LOGS_API_KEY,
	}
};

export { config, secrets };
