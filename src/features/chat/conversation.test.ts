import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../core/config.js';
import { filterHistory } from './conversation.js';

const day = 24 * 60 * 60 * 1000;
const now = 100 * day;
const message = (content: string, daysAgo = 0) => ({ content, createdTimestamp: now - daysAgo * day });

describe('filterHistory', () => {
	it('should stop at the first message older than the age limit', () => {
		const messages = [message('new'), message('old', config.chat.history.maxAgeDays + 1), message('newer again')];
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

	it('should follow a busy conversation back to the last long pause', () => {
		const minute = 60 * 1000;
		const { gapMinutes, minMessages } = config.chat.history;
		const busy = Array.from({ length: minMessages + 5 }, (_, i) => ({ content: `busy ${i}`, createdTimestamp: now - i * minute }));
		const beforePause = { content: 'before the pause', createdTimestamp: busy.at(-1)!.createdTimestamp - (gapMinutes + 1) * minute };
		assert.deepEqual(filterHistory([...busy, beforePause], now).map(m => m.content), busy.map(m => m.content));
	});

	it('should keep a few messages from a quiet channel', () => {
		const hour = 60 * 60 * 1000;
		const { minMessages } = config.chat.history;
		const quiet = Array.from({ length: minMessages + 5 }, (_, i) => ({ content: `quiet ${i}`, createdTimestamp: now - i * 3 * hour }));
		assert.equal(filterHistory(quiet, now).length, minMessages);
	});
});
