import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPanel } from './panel.js';
import { toTracks } from './library.js';
import type { MusicStatus } from './player.js';

function songs(count: number) {
	return toTracks(Array.from({ length: count }, (_, i) => `Song ${String(i).padStart(3, '0')}.mp3`));
}

function render(status: MusicStatus | null, trackCount = 3) {
	const panel = buildPanel(status, songs(trackCount));
	const [buttons, ...menus] = panel.components.map(row => row.toJSON().components) as any[];
	return { embed: panel.embeds[0].toJSON(), buttons, menus: menus.map(row => row[0]) };
}

const tracks = songs(3);
const playing: MusicStatus = { channelId: '1', current: tracks[1], next: tracks[2], paused: false };

describe('buildPanel', () => {
	it('should offer Play and disable Skip and Stop when nothing is playing', () => {
		const { embed, buttons } = render(null);
		assert.match(embed.description!, /Nothing is playing/);
		assert.equal(buttons[0].label, 'Play');
		assert.equal(buttons[1].disabled, true);
		assert.equal(buttons[2].disabled, true);
	});

	it('should show the current and next song while playing', () => {
		const { embed, buttons, menus } = render(playing);
		assert.match(embed.description!, /Now playing: \*\*Song 001\*\*/);
		assert.match(embed.description!, /Up next: Song 002/);
		assert.equal(buttons[0].label, 'Pause');
		assert.equal(buttons[1].disabled, false);
		assert.deepEqual(menus[0].options.filter((o: any) => o.default).map((o: any) => o.label), ['Song 001']);
	});

	it('should offer Resume while paused', () => {
		const { embed, buttons } = render({ ...playing, paused: true });
		assert.match(embed.description!, /Paused/);
		assert.equal(buttons[0].label, 'Resume');
	});

	it('should split songs over menus of 25', () => {
		const { menus, embed } = render(null, 30);
		assert.deepEqual(menus.map((menu: any) => menu.options.length), [25, 5]);
		assert.equal(menus[1].placeholder, 'Pick a song (26-30)');
		assert.equal(embed.footer!.text, '30 songs');
	});

	it('should show at most 100 songs, in four menus', () => {
		const { menus, embed } = render(null, 120);
		assert.equal(menus.length, 4);
		assert.equal(embed.footer!.text, 'Showing the first 100 of 120 songs');
	});

	it('should disable Play and show no menus without songs', () => {
		const { buttons, menus } = render(null, 0);
		assert.equal(buttons[0].disabled, true);
		assert.equal(menus.length, 0);
	});
});
