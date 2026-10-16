import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './situation.js';

describe('buildSystemPrompt', () => {
	it('should add a line about why the bot is replying', () => {
		assert.match(buildSystemPrompt('Be nice.', 'direct', false), /^Be nice\.\n\nSomeone is talking to you/);
		assert.match(buildSystemPrompt('Be nice.', 'random', false), /Nobody asked for you/);
	});

	it('should mention web search only when it is allowed', () => {
		assert.doesNotMatch(buildSystemPrompt('Be nice.', 'direct', false), /search/);
		assert.match(buildSystemPrompt('Be nice.', 'direct', true), /You can search the web/);
	});
});
