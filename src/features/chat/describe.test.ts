import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeMessage, findImages, quote } from './describe.js';
import type { MessageParts } from './describe.js';

const parts = (overrides: Partial<MessageParts>): MessageParts => ({ text: '', attachments: [], embeds: [], ...overrides });
const picture = (size = 1000) => ({ contentType: 'image/png', url: 'https://cdn/picture.png', size });

describe('describeMessage', () => {
	it('should note pictures and files after the text', () => {
		const message = parts({ text: 'look', attachments: [picture(), { contentType: 'video/mp4', url: 'v', size: 1 }, { contentType: null, url: 'f', size: 1 }] });
		assert.equal(describeMessage(message), 'look\n[picture]\n[video]\n[file]');
	});

	it('should describe a picture without text', () => {
		assert.equal(describeMessage(parts({ attachments: [picture()] })), '[picture]');
	});

	it('should show a link preview\'s title and description', () => {
		const message = parts({
			text: 'https://youtube.com/shorts/abc',
			embeds: [{ type: 'video', title: 'Meme Names for WoW Forever', description: 'Leeroy, Zug Zug' }],
		});
		assert.equal(describeMessage(message), 'https://youtube.com/shorts/abc\n[link preview: Meme Names for WoW Forever: Leeroy, Zug Zug]');
	});

	it('should shorten long link descriptions', () => {
		const message = parts({ embeds: [{ type: 'article', title: 'Patch notes', description: 'x'.repeat(500) }] });
		assert.equal(describeMessage(message), `[link preview: Patch notes: ${'x'.repeat(197)}...]`);
	});

	it('should note GIFs and pictures posted as links', () => {
		const message = parts({ text: 'https://tenor.com/a', embeds: [{ type: 'gifv' }, { type: 'image' }] });
		assert.equal(describeMessage(message), 'https://tenor.com/a\n[GIF]\n[picture]');
	});
});

describe('findImages', () => {
	it('should take attached pictures the model can read, then preview pictures', () => {
		const message = parts({
			attachments: [picture(), { contentType: 'image/svg+xml', url: 'svg', size: 1 }, picture(6 * 1024 * 1024)],
			embeds: [{ type: 'gifv', imageUrl: 'https://media/gif.png' }, { type: 'link' }],
		});
		assert.deepEqual(findImages(message), ['https://cdn/picture.png', 'https://media/gif.png']);
	});
});

describe('quote', () => {
	it('should keep a quote on one short line', () => {
		assert.equal(quote('one\ntwo   three'), 'one two three');
		assert.equal(quote('abcdefghij', 8), 'abcde...');
	});
});
