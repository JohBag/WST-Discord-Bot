import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import merge from '../modules/merge.js';
import { validateConfig } from '../tools/validate-config.js';
import { loadRequired } from '../modules/json.js';

describe('merge', () => {
	it('should override scalars and keep untouched keys', () => {
		const result = merge({ name: 'Test Bot', guildId: '1' }, { name: 'Warseeker Bot' });
		assert.deepEqual(result, { name: 'Warseeker Bot', guildId: '1' });
	});

	it('should merge nested objects key by key', () => {
		const result = merge(
			{ channelSettings: { default: { messageLimit: 16, reactChance: 0.005 } } },
			{ channelSettings: { default: { reactChance: 1 } } }
		);
		assert.deepEqual(result, { channelSettings: { default: { messageLimit: 16, reactChance: 1 } } });
	});

	it('should add channel entries without dropping the defaults', () => {
		const result = merge(
			{ channelSettings: { default: { reactChance: 0.005 } } },
			{ channelSettings: { '123': { reactChance: 1 } } }
		);
		assert.deepEqual(result, { channelSettings: { default: { reactChance: 0.005 }, '123': { reactChance: 1 } } });
	});

	it('should replace arrays rather than concatenating them', () => {
		const result = merge({ nicknames: ['botty', 'bot'] }, { nicknames: ['warseeker'] });
		assert.deepEqual(result, { nicknames: ['warseeker'] });
	});

	it('should not mutate the base object', () => {
		const base = { models: { text: 'a' } };
		merge(base, { models: { text: 'b' } });
		assert.equal(base.models.text, 'a');
	});
});

describe('validateConfig', () => {
	const env = { DISCORD_APP_ID: 'x', DISCORD_BOT_TOKEN: 'x', GEMINI_API_KEY: 'x', WARCRAFT_LOGS_API_KEY: 'x' };

	function base(): Record<string, unknown> {
		return loadRequired('config.base');
	}

	it('should accept the committed base config', () => {
		const report = validateConfig(base(), env);
		assert.deepEqual(report.errors, []);
		assert.deepEqual(report.warnings, []);
	});

	it('should report a missing key', () => {
		const config = base();
		delete config.guildId;
		assert.deepEqual(validateConfig(config, env).errors, ['missing: guildId']);
	});

	it('should report a wrong type', () => {
		const config = base();
		config.warcraftLogsGuildId = '66538';
		assert.deepEqual(validateConfig(config, env).errors, ['warcraftLogsGuildId should be number, got string']);
	});

	it('should reject a reactChance outside 0-1', () => {
		const config = base() as any;
		config.channelSettings.default.reactChance = 50;
		assert.deepEqual(validateConfig(config, env).errors, ['channelSettings.default.reactChance should be between 0 and 1, got 50']);
	});

	it('should reject a messageLimit above the discord fetch limit', () => {
		const config = base() as any;
		config.channelSettings.default.messageLimit = 500;
		assert.match(validateConfig(config, env).errors[0], /messageLimit should be between 1 and 100/);
	});

	it('should warn about a misspelled key instead of ignoring it', () => {
		const config = base() as any;
		config.channelSettings['1083851912878768218'].reactChanse = 1;
		assert.deepEqual(validateConfig(config, env).warnings, ['unknown key: channelSettings.1083851912878768218.reactChanse (typo?)']);
	});

	it('should report a misspelled default channel setting exactly once', () => {
		const config = base() as any;
		config.channelSettings.default.reactChanse = 1;
		assert.deepEqual(validateConfig(config, env).warnings, ['unknown key: channelSettings.default.reactChanse (typo?)']);
	});

	it('should allow arbitrary channel ids under channelSettings and blacklist', () => {
		const config = base() as any;
		config.channelSettings['999'] = { reactChance: 0.5 };
		config.blacklist['999'] = 'Some channel';
		assert.deepEqual(validateConfig(config, env).warnings, []);
	});

	it('should require the secrets the bot cannot start without', () => {
		const report = validateConfig(base(), { GEMINI_API_KEY: 'x' });
		assert.deepEqual(report.errors, ['DISCORD_APP_ID is not set (check .env)', 'DISCORD_BOT_TOKEN is not set (check .env)']);
		assert.deepEqual(report.warnings, ['WARCRAFT_LOGS_API_KEY is not set, features that use it will fail']);
	});
});
