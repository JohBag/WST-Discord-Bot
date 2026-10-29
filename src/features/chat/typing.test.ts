import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAnyoneTyping, sentMessage, startedTyping } from './typing.js';

describe('typing', () => {
	it('should count someone as typing until their message arrives', () => {
		startedTyping('sent', 'user', 1000);
		assert.equal(isAnyoneTyping('sent', 2000), true);
		sentMessage('sent', 'user');
		assert.equal(isAnyoneTyping('sent', 2000), false);
	});

	it('should stop counting typing once the signal runs out', () => {
		startedTyping('gave up', 'user', 1000);
		assert.equal(isAnyoneTyping('gave up', 1000 + 9000), true);
		assert.equal(isAnyoneTyping('gave up', 1000 + 11000), false);
	});

	it('should keep waiting for others when one person sends', () => {
		startedTyping('two', 'first', 1000);
		startedTyping('two', 'second', 1000);
		sentMessage('two', 'first');
		assert.equal(isAnyoneTyping('two', 2000), true);
	});

	it('should handle channels separately', () => {
		startedTyping('a', 'user', 1000);
		assert.equal(isAnyoneTyping('b', 2000), false);
	});
});
