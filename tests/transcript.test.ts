import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkResponse, parseTranscript } from '../tools/transcript.js';

describe('parseTranscript', () => {
	it('should parse speaker lines in order', () => {
		const transcript = parseTranscript('Jay: hello\nMochi: hi back', 'sample');
		assert.deepEqual(transcript.messages, [
			{ name: 'Jay', content: 'hello' },
			{ name: 'Mochi', content: 'hi back' },
		]);
	});

	it('should treat a bare url as a continuation, not a speaker', () => {
		const transcript = parseTranscript('Lath: look\nhttps://x.com/status/1', 'sample');
		assert.equal(transcript.messages.length, 1);
		assert.equal(transcript.messages[0].content, 'look\nhttps://x.com/status/1');
	});

	it('should ignore comments and blank lines', () => {
		const transcript = parseTranscript('# a note\n\nJay: hello\n', 'sample');
		assert.equal(transcript.messages.length, 1);
		assert.deepEqual(transcript.expectations, []);
	});

	it('should collect expectations from a directive', () => {
		const transcript = parseTranscript('# expect: no-self-reference, no-ingame-promise\nJay: hi', 'sample');
		assert.deepEqual(transcript.expectations, ['no-self-reference', 'no-ingame-promise']);
	});

	it('should reject an unknown expectation', () => {
		assert.throws(() => parseTranscript('# expect: no-such-check\nJay: hi', 'sample'), /unknown expectation/);
	});
});

describe('checkResponse', () => {
	const expectations = ['no-self-reference', 'no-ingame-promise'];

	function triggered(text: string): string[] {
		return checkResponse(text, expectations).filter(result => result.triggered).map(result => result.id);
	}

	it('should flag the bot reminding people it is a bot', () => {
		assert.deepEqual(triggered("I'm just a bot, but even I know that economy is scuffed."), ['no-self-reference']);
		assert.deepEqual(triggered('Just keep a Soulstone handy for my server rack.'), ['no-self-reference']);
		assert.deepEqual(triggered('Meat shield strat approved 🤖'), ['no-self-reference']);
	});

	it('should flag promises to act in-game', () => {
		assert.deepEqual(triggered("Sure, I'll invite you when I log in."), ['no-ingame-promise']);
	});

	it('should not flag ordinary banter', () => {
		assert.deepEqual(triggered('Goblin engineering is just RNG with extra explosions 💥'), []);
		assert.deepEqual(triggered("0.4% is criminal. Lath owes the raid a repair bill."), []);
	});

	it('should only run the checks a transcript opted into', () => {
		assert.deepEqual(checkResponse("I'm just a bot", ['no-ingame-promise']).map(r => r.triggered), [false]);
	});
});
