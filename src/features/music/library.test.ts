import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { buildPlaylists, shuffle, toTracks, trackId } from './library.js';

describe('toTracks', () => {
	it('should keep audio files only, named without their extension, sorted by name', () => {
		const tracks = toTracks(['b.ogg', 'notes.txt', 'A Song.MP3', 'cover.png'], 'music');
		assert.deepEqual(tracks, [
			{ name: 'A Song', file: path.join('music', 'A Song.MP3') },
			{ name: 'b', file: path.join('music', 'b.ogg') },
		]);
	});
});

describe('buildPlaylists', () => {
	it('should put every song in All songs and give each folder its own playlist', () => {
		const playlists = buildPlaylists(['Theme.mp3'], { Spooky: ['Ghosts.mp3', 'cover.png'], Ambience: ['Wind.ogg'], Empty: ['notes.txt'] });
		assert.deepEqual(playlists.map(p => [p.id, p.name, p.tracks.map(t => t.name)]), [
			['*', 'All songs', ['Ghosts', 'Theme', 'Wind']],
			['Ambience', 'Ambience', ['Wind']],
			['Spooky', 'Spooky', ['Ghosts']],
		]);
	});

	it('should return no playlists without songs', () => {
		assert.deepEqual(buildPlaylists(['notes.txt'], { Empty: [] }), []);
	});
});

describe('trackId', () => {
	it('should be the path inside the music folder, with forward slashes', () => {
		const tracks = buildPlaylists(['Theme.mp3'], { Spooky: ['Ghosts.mp3'] })[0].tracks;
		assert.deepEqual(tracks.map(trackId), ['Spooky/Ghosts.mp3', 'Theme.mp3']);
	});
});

describe('shuffle', () => {
	it('should keep every item exactly once and not modify the input', () => {
		const items = [1, 2, 3, 4, 5];
		const shuffled = shuffle(items);
		assert.deepEqual([...shuffled].sort(), items);
		assert.deepEqual(items, [1, 2, 3, 4, 5]);
	});

	it('should reorder items using the given random source', () => {
		assert.deepEqual(shuffle([1, 2, 3], () => 0), [2, 3, 1]);
	});
});
