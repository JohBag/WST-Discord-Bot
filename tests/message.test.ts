import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Message, { splitResponse } from '../modules/message.js';

describe('Message builder', () => {
	it('should initialize with empty defaults', () => {
		const msg = new Message();
		assert.equal(msg.text, '');
		assert.deepEqual(msg.files, []);
		assert.deepEqual(msg.embeds, []);
		assert.equal(msg.success, true);
	});

	it('should support method chaining', () => {
		const msg = new Message();
		const result = msg.setText('hello').addText(' world');
		assert.equal(result, msg);
		assert.equal(msg.text, 'hello world');
	});

	it('should add files with extracted name', () => {
		const msg = new Message();
		msg.addFile('./media/speech.wav');
		assert.equal(msg.files[0].name, 'speech.wav');
		assert.equal(msg.files[0].attachment, './media/speech.wav');
	});
});

describe('splitResponse', () => {
	it('should return a single chunk for short messages', () => {
		const chunks = splitResponse('hello');
		assert.deepEqual(chunks, ['hello']);
	});

	it('should split on newlines when over the limit', () => {
		const line = 'a'.repeat(1000);
		const input = `${line}\n${line}\n${line}`;
		const chunks = splitResponse(input);
		assert.ok(chunks.length > 1);
		chunks.forEach(chunk => assert.ok(chunk.length <= 2000));
	});

	it('should hard-split when there are no newlines or code blocks', () => {
		const input = 'a'.repeat(5000);
		const chunks = splitResponse(input);
		assert.ok(chunks.length > 1);
		chunks.forEach(chunk => assert.ok(chunk.length <= 2000));
	});

	it('should handle empty string', () => {
		const chunks = splitResponse('');
		assert.deepEqual(chunks, ['']);
	});
});
