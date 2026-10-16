import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from './chat.js';
import { toGeminiContents } from './gemini.js';

describe('getProvider', () => {
	it('should pick the provider from the model name', () => {
		assert.equal(getProvider('claude-sonnet-5-5'), 'claude');
		assert.equal(getProvider('gemini-3.1-pro-preview'), 'gemini');
	});

	it('should reject unknown models', () => {
		assert.throws(() => getProvider('gpt-4o'), /Unknown model/);
	});
});

describe('toGeminiContents', () => {
	it('should give the bot the model role without a name prefix', () => {
		assert.deepEqual(toGeminiContents([
			{ author: 'Jay', content: 'hi', fromBot: false },
			{ author: 'Botty', content: 'Hello!', fromBot: true },
		]), [
			{ role: 'user', parts: [{ text: 'Jay: hi' }] },
			{ role: 'model', parts: [{ text: 'Hello!' }] },
		]);
	});
});
