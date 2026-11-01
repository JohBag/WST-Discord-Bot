import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import log from '../../core/log.js';
import * as storage from '../../core/storage.js';
import { ffmpegPath } from './ffmpeg.js';

// Songs are mastered anywhere from quiet ambience to loud pop, so each one is measured once and turned
// up or down to this loudness (what streaming services play at) before music.volume scales them all
const targetLufs = -14;
// Turning a quiet song up stops before its loudest moment would go over this, in dBFS, so it never clips
const peakCeiling = -1;
// Git-ignored, in config/
const cacheName = 'music-loudness';

export interface Loudness {
	lufs: number;
	peak: number;
}

// Size and modification time tell when a song was replaced by another file with the same name
interface Measurement extends Loudness {
	size: number;
	modified: number;
}

let measurements: Record<string, Measurement> | null = null;
const pending: string[] = [];
let measuring = false;

// Decibels to turn a song up or down by so it plays at the target loudness scaled by volume
export function gainDb(loudness: Loudness, volume: number): number {
	const gain = targetLufs - loudness.lufs + 20 * Math.log10(volume);
	return Math.min(gain, peakCeiling - loudness.peak);
}

// Reads the summary ffmpeg's ebur128 filter prints when it finishes
export function parseLoudness(output: string): Loudness | null {
	const summary = output.slice(output.lastIndexOf('Summary:'));
	const lufs = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
	const peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(summary);
	if (!lufs || !peak) {
		return null;
	}
	return { lufs: Number(lufs[1]), peak: Number(peak[1]) };
}

// The ffmpeg filter that sets a song's volume
export function volumeFilter(file: string, volume: number): string {
	const loudness = measured(file);
	if (loudness) {
		return `volume=${gainDb(loudness, volume).toFixed(2)}dB`;
	}
	// Not measured yet: normalize while playing instead, which also evens out loud and quiet parts within
	// the song. It works at a high sample rate, so it is brought back to Opus's 48 kHz.
	return `loudnorm=I=${targetLufs}:TP=${peakCeiling},aresample=48000,volume=${volume}`;
}

// Measures the songs that aren't measured yet in the background, one at a time, in the given order
export function measure(files: string[]): void {
	for (const file of files) {
		if (!measured(file) && !pending.includes(file)) {
			pending.push(file);
		}
	}
	if (!measuring && pending.length > 0) {
		void measurePending();
	}
}

function measured(file: string): Loudness | null {
	measurements ??= storage.exists(cacheName) ? storage.load<Record<string, Measurement>>(cacheName) : {};
	const measurement = measurements[file];
	if (!measurement) {
		return null;
	}
	try {
		const stats = fs.statSync(file);
		return stats.size === measurement.size && stats.mtimeMs === measurement.modified ? measurement : null;
	} catch {
		return null;
	}
}

async function measurePending(): Promise<void> {
	measuring = true;
	let count = 0;
	while (pending.length > 0) {
		const file = pending.shift()!;
		const loudness = await run(file);
		if (!loudness) {
			log.warn(`Could not measure the loudness of ${file}`);
			continue;
		}
		const stats = fs.statSync(file);
		measurements![file] = { ...loudness, size: stats.size, modified: stats.mtimeMs };
		// Saved after every song, so a restart halfway keeps what was measured
		storage.save(cacheName, measurements);
		count++;
	}
	measuring = false;
	if (count > 0) {
		log(`Measured the loudness of ${count} songs`);
	}
}

function run(file: string): Promise<Loudness | null> {
	return new Promise(resolve => {
		const ffmpeg = spawn(ffmpegPath, [
			'-hide_banner', '-nostats',
			'-i', file,
			'-vn',
			'-af', 'ebur128=peak=sample:framelog=quiet',
			'-f', 'null', '-',
		], { stdio: ['ignore', 'ignore', 'pipe'] });
		// Lowest priority, so it never takes time from the song that is playing
		try {
			os.setPriority(ffmpeg.pid!, 19);
		} catch {
			// Measuring at normal priority is fine too
		}
		let output = '';
		ffmpeg.stderr.on('data', data => output += data);
		ffmpeg.on('error', () => resolve(null));
		ffmpeg.on('close', () => resolve(parseLoudness(output)));
	});
}
