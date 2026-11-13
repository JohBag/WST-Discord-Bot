import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toClaudeMessages } from './claude.js';
import { describePause } from './conversation.js';
import type { ChatMessage } from './conversation.js';

const user = (author: string, content: string): ChatMessage => ({ author, content, fromBot: false });
const bot = (content: string): ChatMessage => ({ author: 'Botty', content, fromBot: true });

describe('toClaudeMessages', () => {
	it('should prefix other people with their name but not the bot', () => {
		assert.deepEqual(toClaudeMessages([user('Jay', 'hi botty'), bot('Hello!'), user('Jay', 'thanks')]), [
			{ role: 'user', content: 'Jay: hi botty' },
			{ role: 'assistant', content: 'Hello!' },
			{ role: 'user', content: 'Jay: thanks' },
		]);
	});

	it('should merge people talking in a row into one turn', () => {
		assert.deepEqual(toClaudeMessages([user('Jay', 'wipe'), user('Mochi', 'again'), bot('Oof.'), bot('Try again.'), user('Jay', 'botty?')]), [
			{ role: 'user', content: 'Jay: wipe\nMochi: again' },
			{ role: 'assistant', content: 'Oof.\nTry again.' },
			{ role: 'user', content: 'Jay: botty?' },
		]);
	});

	it('should drop bot messages at the start and end', () => {
		assert.deepEqual(toClaudeMessages([bot('Earlier'), user('Jay', 'hi'), bot('Already answered')]), [
			{ role: 'user', content: 'Jay: hi' },
		]);
	});

	it('should say what a message replies to', () => {
		const reply: ChatMessage = { author: 'Jay', content: 'Spelt aye', fromBot: false, replyTo: { author: 'Bart', content: 'i' } };
		assert.deepEqual(toClaudeMessages([reply]), [
			{ role: 'user', content: 'Jay (replying to Bart: "i"): Spelt aye' },
		]);
	});

	it('should put pictures right after the line they came with', () => {
		const image = { mediaType: 'image/png' as const, data: 'abc' };
		const withPicture: ChatMessage = { author: 'Lath', content: 'look\n[picture]', fromBot: false, images: [image] };
		assert.deepEqual(toClaudeMessages([user('Jay', 'hi'), withPicture, user('Jay', 'lol')]), [
			{
				role: 'user', content: [
					{ type: 'text', text: 'Jay: hi\nLath: look\n[picture]' },
					{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
					{ type: 'text', text: 'Jay: lol' },
				],
			},
		]);
	});

	it('should mark a long pause before the message that ends it', () => {
		const hour = 60 * 60 * 1000;
		const afterPause: ChatMessage = { author: 'Mochi', content: 'new meme', fromBot: false, pauseBefore: 14 * hour + 10 * 60 * 1000 };
		assert.deepEqual(toClaudeMessages([user('Jay', 'old meme'), afterPause]), [
			{ role: 'user', content: 'Jay: old meme\n(14 hours later)\nMochi: new meme' },
		]);
	});

	it('should name the pause in hours under a day and in days after', () => {
		const hour = 60 * 60 * 1000;
		assert.equal(describePause(61 * 60 * 1000), '1 hour later');
		assert.equal(describePause(23 * hour), '23 hours later');
		assert.equal(describePause(26 * hour), '1 day later');
		assert.equal(describePause(50 * hour), '2 days later');
	});

	it('should return nothing when only the bot has spoken', () => {
		assert.deepEqual(toClaudeMessages([bot('Anyone there?')]), []);
	});
});
