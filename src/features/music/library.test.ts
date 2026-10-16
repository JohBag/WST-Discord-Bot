import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { findTrack, searchTracks, shuffle, toTracks } from './library.js';

describe('toTracks', () => {
	it('should keep audio files only, named without their extension, sorted by name', () => {
		const tracks = toTracks(['b.ogg', 'notes.txt', 'A Song.MP3', 'cover.png'], 'music');
		assert.deepEqual(tracks, [
			{ name: 'A Song', file: path.join('music', 'A Song.MP3') },
			{ name: 'b', file: path.join('music', 'b.ogg') },
		]);
	});
});

describe('findTrack', () => {
	const tracks = toTracks(['One More Elite Remix.mp3', 'One More Elite.mp3', 'Spooky.mp3']);

	it('should prefer an exact name over a partial match', () => {
		assert.equal(findTrack(tracks, 'one more elite')?.name, 'One More Elite');
	});

	it('should fall back to a partial match', () => {
		assert.equal(findTrack(tracks, 'spoo')?.name, 'Spooky');
	});

	it('should return undefined when nothing matches', () => {
		assert.equal(findTrack(tracks, 'jazz'), undefined);
	});
});

describe('searchTracks', () => {
	it('should match case-insensitively anywhere in the name', () => {
		const tracks = toTracks(['Ghost Town.mp3', 'Haunted.mp3', 'Ghostbusters.mp3']);
		assert.deepEqual(searchTracks(tracks, 'GHOST').map(track => track.name), ['Ghost Town', 'Ghostbusters']);
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
