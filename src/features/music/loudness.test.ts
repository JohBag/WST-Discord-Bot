import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gainDb, parseLoudness, volumeFilter } from './loudness.js';

describe('gainDb', () => {
	it('should turn a loud song down to the target loudness', () => {
		assert.equal(gainDb({ lufs: -8, peak: 2 }, 1), -6);
	});

	it('should turn a quiet song up to the target loudness', () => {
		assert.equal(gainDb({ lufs: -20, peak: -10 }, 1), 6);
	});

	it('should apply the volume on top', () => {
		assert.equal(gainDb({ lufs: -14, peak: -3 }, 0.1), -20);
	});

	it('should stop turning a song up before its peaks would clip', () => {
		assert.equal(gainDb({ lufs: -24, peak: -4 }, 1), 3);
	});
});

describe('parseLoudness', () => {
	it('should read the loudness and peak from the ebur128 summary', () => {
		const output = [
			'size=N/A time=00:03:32.48 bitrate=N/A speed= 439x',
			'[Parsed_ebur128_0 @ 0000022bd5d42fc0] Summary:',
			'',
			'  Integrated loudness:',
			'    I:          -8.0 LUFS',
			'    Threshold: -18.2 LUFS',
			'',
			'  Loudness range:',
			'    LRA:         6.3 LU',
			'    Threshold: -28.2 LUFS',
			'    LRA low:   -12.1 LUFS',
			'    LRA high:   -5.8 LUFS',
			'',
			'  Sample peak:',
			'    Peak:        2.1 dBFS',
		].join('\n');
		assert.deepEqual(parseLoudness(output), { lufs: -8, peak: 2.1 });
	});

	it('should give nothing when ffmpeg failed', () => {
		assert.equal(parseLoudness('music/missing.mp3: No such file or directory'), null);
	});
});

describe('volumeFilter', () => {
	it('should normalize while playing when the song is not measured', () => {
		assert.equal(volumeFilter('music/not-measured.mp3', 0.25), 'loudnorm=I=-14:TP=-1,aresample=48000,volume=0.25');
	});
});
