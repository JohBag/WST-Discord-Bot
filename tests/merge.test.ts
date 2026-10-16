import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import merge from '../modules/merge.js';

describe('merge', () => {
	it('should override nested values and keep the rest', () => {
		const base = { name: 'Prod', voiceChat: { voiceName: 'Zephyr', defaultChannelId: '' }, guildId: '1' };
		const result = merge(base, { name: 'Test', voiceChat: { defaultChannelId: '2' } });
		assert.deepEqual(result, { name: 'Test', voiceChat: { voiceName: 'Zephyr', defaultChannelId: '2' }, guildId: '1' });
	});

	it('should replace arrays instead of merging them', () => {
		const result = merge({ nicknames: ['botty', 'bot'] }, { nicknames: ['test'] });
		assert.deepEqual(result.nicknames, ['test']);
	});

	it('should not modify the base object', () => {
		const base = { voiceChat: { voiceName: 'Zephyr' } };
		merge(base, { voiceChat: { voiceName: 'Puck' } });
		assert.equal(base.voiceChat.voiceName, 'Zephyr');
	});
});
