import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPanel } from './panel.js';
import { buildPlaylists } from './library.js';
import type { Selection } from './panel.js';
import type { MusicStatus, PlayMode } from './player.js';

function songs(count: number) {
	return Array.from({ length: count }, (_, i) => `Song ${String(i).padStart(3, '0')}.mp3`);
}

function render(status: MusicStatus | null, { loose = 3, folders = {} as Record<string, string[]>, mode = 'continue' as PlayMode, selection = undefined as Selection | undefined } = {}) {
	const panel = buildPanel(status, buildPlaylists(songs(loose), folders), mode, selection);
	const [buttons, ...menus] = panel.components.map(row => row.toJSON().components) as any[];
	return { embed: panel.embeds[0].toJSON(), buttons, menus: menus.map(row => row[0]) };
}

const tracks = buildPlaylists(songs(3), {})[0].tracks;
const playing: MusicStatus = { channelId: '1', playlistId: '*', current: tracks[1], next: tracks[2], paused: false };

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

	it('should show the play mode on its button', () => {
		assert.equal(render(null).buttons[3].label, 'Play all');
		assert.equal(render(null, { mode: 'repeat' }).buttons[3].label, 'Repeat song');
		assert.equal(render(null, { mode: 'once' }).buttons[3].label, 'Play once');
	});

	it('should split songs over menus of 25', () => {
		const { menus, embed } = render(null, { loose: 30 });
		assert.deepEqual(menus.map((menu: any) => menu.options.length), [25, 5]);
		assert.equal(menus[1].placeholder, 'Pick a song (26-30)');
		assert.equal(embed.footer!.text, '30 songs');
	});

	it('should show at most 100 songs, in four menus', () => {
		const { menus, embed } = render(null, { loose: 120 });
		assert.equal(menus.length, 4);
		assert.equal(embed.footer!.text, 'Showing the first 100 of 120 songs');
	});

	it('should disable Play and show no menus without songs', () => {
		const { buttons, menus } = render(null, { loose: 0 });
		assert.equal(buttons[0].disabled, true);
		assert.equal(menus.length, 0);
	});

	it('should add a playlist menu when there are folders, leaving room for three song menus', () => {
		const { menus, embed } = render(null, { loose: 100, folders: { Ambience: ['Wind.mp3', 'Rain.ogg'] } });
		assert.deepEqual(menus[0].options.map((o: any) => o.label), ['All songs', 'Ambience']);
		assert.equal(menus.length, 4);
		assert.equal(embed.footer!.text, 'All songs: Showing the first 75 of 102 songs');
	});

	it('should list the songs of the playlist that is playing', () => {
		const playlists = buildPlaylists(songs(3), { Ambience: ['Wind.mp3', 'Rain.ogg'] });
		const rain = playlists[1].tracks[0];
		const panel = buildPanel({ channelId: '1', playlistId: 'Ambience', current: rain, next: null, paused: false }, playlists, 'continue');
		const [, playlistMenu, songMenu] = panel.components.map(row => row.toJSON().components[0]) as any[];
		assert.deepEqual(playlistMenu.options.filter((o: any) => o.default).map((o: any) => o.label), ['Ambience']);
		assert.deepEqual(songMenu.options.map((o: any) => o.label), ['Rain', 'Wind']);
		assert.equal(songMenu.custom_id, 'music-panel:song:0:Ambience');
	});

	it('should ask for Play when another song is selected while one is playing', () => {
		const { embed, buttons, menus } = render(playing, { selection: { playlistId: '*', trackId: 'Song 002.mp3' } });
		assert.equal(buttons[0].label, 'Play');
		assert.match(embed.description!, /Now playing: \*\*Song 001\*\*/);
		assert.match(embed.description!, /Selected: \*\*Song 002\*\*\. Press ▶️ Play/);
		assert.deepEqual(menus[0].options.filter((o: any) => o.default).map((o: any) => o.label), ['Song 002']);
	});

	it('should show a selected playlist and its songs without starting it', () => {
		const { embed, buttons, menus } = render(null, { folders: { Ambience: ['Wind.mp3'] }, selection: { playlistId: 'Ambience' } });
		assert.equal(buttons[0].label, 'Play');
		assert.match(embed.description!, /Selected: \*\*Ambience\*\*/);
		assert.deepEqual(menus[0].options.filter((o: any) => o.default).map((o: any) => o.label), ['Ambience']);
		assert.deepEqual(menus[1].options.map((o: any) => o.label), ['Wind']);
	});

	it('should treat selecting what is already playing as no change', () => {
		const { embed, buttons } = render(playing, { selection: { playlistId: '*', trackId: 'Song 001.mp3' } });
		assert.equal(buttons[0].label, 'Pause');
		assert.doesNotMatch(embed.description!, /Selected/);
	});
});
