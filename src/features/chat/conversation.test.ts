import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../core/config.js';
import { filterHistory } from './conversation.js';

const day = 24 * 60 * 60 * 1000;
const now = 100 * day;
const message = (content: string, daysAgo = 0) => ({ content, createdTimestamp: now - daysAgo * day });

describe('filterHistory', () => {
	it('should stop at the first message older than the age limit', () => {
		const messages = [message('new'), message('old', config.chat.ageLimitDays + 1), message('newer again')];
		assert.deepEqual(filterHistory(messages, now).map(m => m.content), ['new']);
	});

	it('should stop at the cutoff marker', () => {
		const messages = [message('after'), message(config.chat.cutoff), message('before')];
		assert.deepEqual(filterHistory(messages, now).map(m => m.content), ['after']);
	});

	it('should drop empty messages', () => {
		const messages = [message('text'), message('  '), message('more')];
		assert.deepEqual(filterHistory(messages, now).map(m => m.content), ['text', 'more']);
	});
});
