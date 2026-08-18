/**
 * Shows the config this instance will actually run with, and refuses a bad one.
 *
 * npm run check-config
 *
 * Merges config/config.base.json with the git-ignored config/config.json exactly
 * the way the bot does, reports where each override came from, and exits non-zero
 * on anything that would break at startup. Run it before restarting the bot.
 */

process.env.LOG_FILE ||= 'log-check-config.txt';

import fs from 'node:fs';
import { validateConfig } from './validate-config.js';

const KEYS_TO_SHOW = [
	'name',
	'nicknames',
	'guildId',
	'logChannelId',
	'newUsersRoleId',
	'models.text',
	'chat.ageLimitDays',
	'channelSettings.default.messageLimit',
	'channelSettings.default.reactChance',
	'warcraftLogsGuildId',
];

const { config, CONFIG_BASE, CONFIG_LOCAL, PROMPT_BASE, PROMPT_LOCAL } = await import('../modules/data.js');
const { loadOptional } = await import('../modules/json.js');

const localFile = `config/${CONFIG_LOCAL}.json`;
const local = loadOptional<Record<string, unknown>>(CONFIG_LOCAL);
const promptFile = fs.existsSync(PROMPT_LOCAL) ? PROMPT_LOCAL : PROMPT_BASE;

console.log(`\nbase    config/${CONFIG_BASE}.json`);
console.log(local
	? `local   ${localFile}  overrides: ${Object.keys(local).join(', ') || '(empty file)'}`
	: `local   ${localFile}  (absent, running on the base config)`);
console.log(`prompt  ${promptFile}  ${config.prompt.length} chars${promptFile === PROMPT_BASE ? ', tracked in git' : ', local only'}`);

console.log('\nresolved');
for (const key of KEYS_TO_SHOW) {
	const value = key.split('.').reduce<any>((node, part) => node?.[part], config);
	const source = local && overriddenBy(local, key.split('.')) ? '  <- local' : '';
	console.log(`  ${key.padEnd(36)} ${JSON.stringify(value) ?? '(missing)'}${source}`);
}

const report = validateConfig(config, process.env);

if (config.prompt.trim() === '') {
	report.errors.push(`${promptFile} is empty, the bot would run without a system prompt`);
}

for (const warning of report.warnings) {
	console.log(`\nWARN  ${warning}`);
}
for (const error of report.errors) {
	console.error(`\nFAIL  ${error}`);
}

if (report.errors.length > 0) {
	console.error(`\n${report.errors.length} problem(s) found. Not safe to start.\n`);
	process.exit(1);
}

console.log(`\nConfig OK${report.warnings.length > 0 ? ` (${report.warnings.length} warning(s))` : ''}.\n`);

function overriddenBy(local: Record<string, unknown>, path: string[]): boolean {
	let node: unknown = local;
	for (const part of path) {
		if (typeof node !== 'object' || node === null || !(part in node)) {
			return false;
		}
		node = (node as Record<string, unknown>)[part];
	}
	return true;
}
