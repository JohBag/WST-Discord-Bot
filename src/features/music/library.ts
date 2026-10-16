import fs from 'fs';
import path from 'path';

// Git-ignored; copied to the VM with `npm run vm -- music`
export const musicFolder = 'music';
const audioExtensions = ['.mp3', '.ogg', '.opus', '.wav', '.flac', '.m4a'];

export interface Track {
	name: string;
	file: string;
}

export interface Playlist {
	id: string;
	name: string;
	tracks: Track[];
}

// Folder names can't be "*", so it can't clash with a folder playlist
export const allSongsId = '*';

export function toTracks(fileNames: string[], folder: string = musicFolder): Track[] {
	return fileNames
		.filter(fileName => audioExtensions.includes(path.extname(fileName).toLowerCase()))
		.map(fileName => ({ name: path.parse(fileName).name, file: path.join(folder, fileName) }))
		.sort(byName);
}

// Every song is in "All songs", and each folder inside music/ is also a playlist of its own
export function buildPlaylists(looseFiles: string[], folders: Record<string, string[]>): Playlist[] {
	const folderPlaylists = Object.entries(folders)
		.map(([name, files]) => ({ id: name, name, tracks: toTracks(files, path.join(musicFolder, name)) }))
		.filter(playlist => playlist.tracks.length > 0)
		.sort(byName);
	const all = [...toTracks(looseFiles), ...folderPlaylists.flatMap(playlist => playlist.tracks)].sort(byName);
	if (all.length === 0) {
		return [];
	}
	return [{ id: allSongsId, name: 'All songs', tracks: all }, ...folderPlaylists];
}

// Read on every call so newly uploaded songs show up without a restart
export function listPlaylists(): Playlist[] {
	if (!fs.existsSync(musicFolder)) {
		return [];
	}
	const entries = fs.readdirSync(musicFolder, { withFileTypes: true });
	const folders = Object.fromEntries(entries
		.filter(entry => entry.isDirectory())
		.map(entry => [entry.name, fs.readdirSync(path.join(musicFolder, entry.name))]));
	return buildPlaylists(entries.filter(entry => entry.isFile()).map(entry => entry.name), folders);
}

export function findPlaylist(id: string): Playlist | undefined {
	return listPlaylists().find(playlist => playlist.id === id);
}

// Unique within the music folder, and what select menus use to refer to a song
export function trackId(track: Track): string {
	return path.relative(musicFolder, track.file).split(path.sep).join('/');
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function byName(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name);
}
