import { spawnSync } from 'child_process';
import { createRequire } from 'module';

// Bundled through npm so the VM needs no system package; falls back to one on the PATH.
// ffmpeg-static is CommonJS with types that claim an ES default export, so it is required directly.
const ffmpegStatic: string | null = createRequire(import.meta.url)('ffmpeg-static');
export const ffmpegPath = ffmpegStatic ?? 'ffmpeg';
let ffmpegAvailable: boolean | null = null;

export function hasFfmpeg(): boolean {
	ffmpegAvailable ??= spawnSync(ffmpegPath, ['-version']).status === 0;
	return ffmpegAvailable;
}
