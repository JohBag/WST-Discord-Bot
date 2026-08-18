// Pure validation for the merged config. No side effects, no network.

type Spec = string | { [key: string]: Spec };

const CHANNEL_SETTINGS: Spec = {
	messageLimit: 'number',
	reactChance: 'number',
	textToSpeech: 'boolean',
};

const SCHEMA: Record<string, Spec> = {
	name: 'string',
	nicknames: 'string[]',
	models: {
		text: 'string',
		transcribe: 'string',
		tts: 'string',
		image: 'string',
		voice: 'string',
	},
	chat: {
		cutoff: 'string',
		ageLimitDays: 'number',
	},
	voiceChat: {
		voiceName: 'string',
		maxReconnectAttempts: 'number',
		defaultChannelId: 'string',
	},
	channelSettings: { default: CHANNEL_SETTINGS },
	blacklist: 'object',
	media: {
		speechFile: 'string',
		imageFile: 'string',
	},
	newUsersRoleId: 'string',
	guildId: 'string',
	logChannelId: 'string',
	warcraftLogsGuildId: 'number',
};

const REQUIRED_ENV = ['DISCORD_APP_ID', 'DISCORD_BOT_TOKEN', 'GEMINI_API_KEY'];
const OPTIONAL_ENV = ['WARCRAFT_LOGS_API_KEY'];

export interface Report {
	errors: string[];
	warnings: string[];
}

export function validateConfig(config: unknown, env: Record<string, string | undefined> = {}): Report {
	const report: Report = { errors: [], warnings: [] };

	if (!isObject(config)) {
		report.errors.push('config is not an object');
		return report;
	}

	walk(config, SCHEMA, '', report);
	checkChannelSettings(config.channelSettings, report);

	for (const key of REQUIRED_ENV) {
		if (!env[key]) {
			report.errors.push(`${key} is not set (check .env)`);
		}
	}
	for (const key of OPTIONAL_ENV) {
		if (!env[key]) {
			report.warnings.push(`${key} is not set, features that use it will fail`);
		}
	}

	return report;
}

function walk(value: Record<string, unknown>, spec: Record<string, Spec>, path: string, report: Report): void {
	for (const [key, expected] of Object.entries(spec)) {
		const child = value[key];
		const childPath = path ? `${path}.${key}` : key;

		if (child === undefined) {
			report.errors.push(`missing: ${childPath}`);
			continue;
		}

		if (typeof expected === 'string') {
			const actual = typeName(child);
			if (actual !== expected) {
				report.errors.push(`${childPath} should be ${expected}, got ${actual}`);
			}
			continue;
		}

		if (!isObject(child)) {
			report.errors.push(`${childPath} should be an object, got ${typeName(child)}`);
			continue;
		}

		walk(child, expected, childPath, report);

		// checkChannelSettings owns everything below channelSettings, including 'default'
		if (!childPath.startsWith('channelSettings')) {
			for (const extra of Object.keys(child).filter(name => !(name in expected))) {
				report.warnings.push(`unknown key: ${childPath}.${extra} (typo?)`);
			}
		}
	}

	if (path === '') {
		for (const extra of Object.keys(value).filter(name => !(name in spec) && name !== 'prompt')) {
			report.warnings.push(`unknown key: ${extra} (typo?)`);
		}
	}
}

function checkChannelSettings(channelSettings: unknown, report: Report): void {
	if (!isObject(channelSettings)) {
		return;
	}

	for (const [channelId, settings] of Object.entries(channelSettings)) {
		const path = `channelSettings.${channelId}`;

		if (!isObject(settings)) {
			report.errors.push(`${path} should be an object, got ${typeName(settings)}`);
			continue;
		}

		for (const [key, value] of Object.entries(settings)) {
			const expected = (CHANNEL_SETTINGS as Record<string, string>)[key];
			if (!expected) {
				report.warnings.push(`unknown key: ${path}.${key} (typo?)`);
				continue;
			}
			if (typeName(value) !== expected) {
				report.errors.push(`${path}.${key} should be ${expected}, got ${typeName(value)}`);
				continue;
			}
			if (key === 'reactChance' && ((value as number) < 0 || (value as number) > 1)) {
				report.errors.push(`${path}.reactChance should be between 0 and 1, got ${value}`);
			}
			if (key === 'messageLimit' && ((value as number) < 1 || (value as number) > 100)) {
				report.errors.push(`${path}.messageLimit should be between 1 and 100, got ${value}`);
			}
		}
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (Array.isArray(value)) {
		return value.every(entry => typeof entry === 'string') ? 'string[]' : 'array';
	}
	if (value === null) {
		return 'null';
	}
	return typeof value;
}
