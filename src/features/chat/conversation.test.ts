import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../core/config.js';
import { filterHistory, pickImages, placeReplies, rememberReply } from './conversation.js';

const day = 24 * 60 * 60 * 1000;
const now = 100 * day;
const message = (content: string, daysAgo = 0) => ({ content, createdTimestamp: now - daysAgo * day });

describe('filterHistory', () => {
	it('should stop at the first message older than the age limit', () => {
		const messages = [message('new'), message('old', config.chat.history.maxAgeDays + 1), message('newer again')];
		assert.deepEqual(filterHistory(messages, now).map(m => m.content), ['new']);
	});

	it('should stop at the reset marker', () => {
		const messages = [message('after'), message(config.chat.history.resetMarker), message('before')];
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

describe('placeReplies', () => {
	const at = (id: string, createdTimestamp: number) => ({ id, createdTimestamp });

	it('should move a reply back to right after the newest message it had read', () => {
		rememberReply(['reply'], 100);
		// Newest first: the second question came in while the reply was being written
		const messages = [at('reply', 300), at('second question', 200), at('question', 100), at('earlier', 50)];
		assert.deepEqual(placeReplies(messages).map(m => m.id), ['second question', 'reply', 'question', 'earlier']);
	});

	it('should keep a split reply in order', () => {
		rememberReply(['part 1', 'part 2'], 100);
		const messages = [at('part 2', 310), at('part 1', 300), at('interrupt', 200), at('question', 100)];
		assert.deepEqual(placeReplies(messages).map(m => m.id), ['interrupt', 'part 2', 'part 1', 'question']);
	});

	it('should leave messages it knows nothing about where they are', () => {
		const messages = [at('c', 300), at('b', 200), at('a', 100)];
		assert.deepEqual(placeReplies(messages).map(m => m.id), ['c', 'b', 'a']);
	});
});

describe('pickImages', () => {
	it('should show the newest pictures up to the limit', () => {
		const messages = [
			{ id: 'newest', images: ['a'] },
			{ id: 'text', images: [] },
			{ id: 'two', images: ['b', 'c'] },
			{ id: 'old', images: ['d'] },
		];
		assert.deepEqual([...pickImages(messages, 2)], [['newest', ['a']], ['two', ['b']]]);
	});
});
