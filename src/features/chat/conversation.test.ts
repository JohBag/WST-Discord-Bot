import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../core/config.js';
import { filterHistory, markPauses, pickImages, placeReplies, rememberReply } from './conversation.js';

const day = 24 * 60 * 60 * 1000;
const now = 100 * day;
const message = (content: string, daysAgo = 0) => ({ content, createdTimestamp: now - daysAgo * day });

describe('filterHistory', () => {
	it('should stop at the first message older than the age limit', () => {
		const messages = [message('new'), message('old', config.chat.history.maxAgeDays + 1), message('newer again')];
		assert.deepEqual(filterHistory(messages, now, 'direct').map(m => m.content), ['new']);
	});

	it('should stop at the reset marker', () => {
		const messages = [message('after'), message(config.chat.history.resetMarker), message('before')];
		assert.deepEqual(filterHistory(messages, now, 'direct').map(m => m.content), ['after']);
	});

	it('should drop empty messages', () => {
		const messages = [message('text'), message('  '), message('more')];
		assert.deepEqual(filterHistory(messages, now, 'direct').map(m => m.content), ['text', 'more']);
	});

	it('should follow a busy conversation back to the last long pause', () => {
		const minute = 60 * 1000;
		const { gapMinutes, minMessages } = config.chat.history;
		const busy = Array.from({ length: minMessages + 5 }, (_, i) => ({ content: `busy ${i}`, createdTimestamp: now - i * minute }));
		const beforePause = { content: 'before the pause', createdTimestamp: busy.at(-1)!.createdTimestamp - (gapMinutes + 1) * minute };
		assert.deepEqual(filterHistory([...busy, beforePause], now, 'direct').map(m => m.content), busy.map(m => m.content));
	});

	it('should keep a few messages from a quiet channel', () => {
		const hour = 60 * 60 * 1000;
		const { minMessages } = config.chat.history;
		const quiet = Array.from({ length: minMessages + 5 }, (_, i) => ({ content: `quiet ${i}`, createdTimestamp: now - i * 3 * hour }));
		assert.equal(filterHistory(quiet, now, 'direct').length, minMessages);
	});

	it('should only read the conversation going on now when dropping in uninvited', () => {
		const minute = 60 * 1000;
		const { gapMinutes } = config.chat.history;
		const today = [{ content: 'today', createdTimestamp: now }, { content: 'also today', createdTimestamp: now - minute }];
		const yesterday = Array.from({ length: 5 }, (_, i) => ({ content: `yesterday ${i}`, createdTimestamp: now - (gapMinutes + 10) * minute - i * minute }));
		assert.deepEqual(filterHistory([...today, ...yesterday], now, 'random').map(m => m.content), ['today', 'also today']);
		assert.equal(filterHistory([...today, ...yesterday], now, 'direct').length, today.length + yesterday.length);
	});
});

describe('markPauses', () => {
	const hour = 60 * 60 * 1000;
	const person = (hoursAgo: number) => ({ createdTimestamp: now - hoursAgo * hour, fromBot: false });
	const botPost = (hoursAgo: number) => ({ createdTimestamp: now - hoursAgo * hour, fromBot: true });

	it('should mark the message after a long pause with the time since the one before', () => {
		assert.deepEqual(markPauses([person(14.2), person(14.1), person(0.1), person(0)]), [undefined, undefined, 14 * hour, undefined]);
	});

	it('should mark nothing in a conversation without long pauses', () => {
		assert.deepEqual(markPauses([person(0.9), person(0.5), person(0)]), [undefined, undefined, undefined]);
	});

	it('should move a pause that ends with the bot\'s own post to the next person, timed from before the pause', () => {
		// Chat at night, a /log summary in the morning, then a ping half an hour later
		assert.deepEqual(markPauses([person(10.5), botPost(0.5), person(0)]), [undefined, undefined, 10.5 * hour]);
	});

	it('should time a pause from the bot\'s reply when a person ends it', () => {
		// Botty answers right away, then the channel goes quiet for almost two hours
		assert.deepEqual(markPauses([person(2), botPost(1.8), person(0)]), [undefined, undefined, 1.8 * hour]);
	});

	it('should carry a pause past several bot posts in a row', () => {
		assert.deepEqual(markPauses([person(12), botPost(11.9), botPost(0.5), person(0.4)]), [undefined, undefined, undefined, 11.6 * hour]);
	});

	it('should not mark a short gap after the bot\'s reply', () => {
		assert.deepEqual(markPauses([person(0.2), botPost(0.1), person(0)]), [undefined, undefined, undefined]);
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
