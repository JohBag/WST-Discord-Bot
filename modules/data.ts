import fs from 'fs';
import { loadOptional, loadRequired } from './json.js';
import merge from './merge.js';
import log from './log.js';
import type { Config, Secrets } from '../types.js';

export const CONFIG_BASE = 'config.base';
export const CONFIG_LOCAL = 'config';
export const PROMPT_BASE = 'config/prompt.base.txt';
export const PROMPT_LOCAL = 'config/prompt.txt';

const config = loadConfig();
config.prompt = loadPrompt();

/**
 * config.base.json is committed and shared by every instance. config.json is
 * per-instance and git-ignored - it only needs the keys that differ, and is
 * deep-merged on top of the base.
 */
function loadConfig(): Config {
	const base = loadRequired<Config>(CONFIG_BASE);
	const local = loadOptional<Partial<Config>>(CONFIG_LOCAL);

	if (local) {
		log(`Applying config overrides: ${Object.keys(local).join(', ') || '(none)'}`);
	}

	return merge(base, local ?? {});
}

/** prompt.txt is a git-ignored override. Without it the committed prompt.base.txt is used. */
function loadPrompt(): string {
	for (const file of [PROMPT_LOCAL, PROMPT_BASE]) {
		if (fs.existsSync(file)) {
			log(`Using prompt from ${file}`);
			return fs.readFileSync(file, 'utf8');
		}
	}

	log.warn(`No ${PROMPT_BASE} found, using an empty system prompt`);
	return '';
}

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
