import fs from 'fs';
import path from 'path';

// Git-ignored; copied to the VM with `npm run vm -- music`
export const musicFolder = 'music';
const audioExtensions = ['.mp3', '.ogg', '.opus', '.wav', '.flac', '.m4a'];

export interface Track {
	name: string;
	file: string;
}

export function toTracks(fileNames: string[], folder: string = musicFolder): Track[] {
	return fileNames
		.filter(fileName => audioExtensions.includes(path.extname(fileName).toLowerCase()))
		.map(fileName => ({ name: path.parse(fileName).name, file: path.join(folder, fileName) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

// Read on every call so newly uploaded songs show up without a restart
export function listTracks(): Track[] {
	if (!fs.existsSync(musicFolder)) {
		return [];
	}
	return toTracks(fs.readdirSync(musicFolder));
}

export function searchTracks(tracks: Track[], query: string): Track[] {
	const needle = query.trim().toLowerCase();
	return tracks.filter(track => track.name.toLowerCase().includes(needle));
}

// Exact name first, so "Elite" does not lose to "Elite Remix" when both exist
export function findTrack(tracks: Track[], query: string): Track | undefined {
	const needle = query.trim().toLowerCase();
	return tracks.find(track => track.name.toLowerCase() === needle) ?? searchTracks(tracks, query)[0];
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
