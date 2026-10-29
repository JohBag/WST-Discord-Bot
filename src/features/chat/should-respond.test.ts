import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isForSomeoneElse } from './should-respond.js';

describe('isForSomeoneElse', () => {
	it('should be true for a reply to or ping of another member', () => {
		assert.equal(isForSomeoneElse('ana', ['jay'], 'botty'), true);
		assert.equal(isForSomeoneElse('ana', [undefined, 'jay'], 'botty'), true);
	});

	it('should be false for plain messages, replies to yourself and pings of the bot', () => {
		assert.equal(isForSomeoneElse('ana', [], 'botty'), false);
		assert.equal(isForSomeoneElse('ana', [undefined], 'botty'), false);
		assert.equal(isForSomeoneElse('ana', ['ana'], 'botty'), false);
		assert.equal(isForSomeoneElse('ana', ['botty'], 'botty'), false);
	});
});
