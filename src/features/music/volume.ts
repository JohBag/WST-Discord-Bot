import { config } from '../../core/config.js';
import log from '../../core/log.js';
import * as storage from '../../core/storage.js';

// The levels in the panel's volume menu, in percent
export const volumeLevels = Array.from({ length: 20 }, (_, i) => i + 1);
// Kept per guild so a restart doesn't reset it; git-ignored, in config/
const volumesName = 'music-volumes';

let volumes: Record<string, number> | null = null;

// The panel's setting, else music.volume from the config
export function getVolume(guildId: string): number {
	if (!volumes) {
		// A damaged file only loses the saved volumes, so the music keeps working
		try {
			volumes = storage.load<Record<string, number>>(volumesName);
		} catch (error) {
			log.warn(`Starting with default volumes: ${error}`);
			volumes = {};
		}
	}
	return volumes[guildId] ?? config.music.volume;
}

export function setVolume(guildId: string, volume: number): void {
	getVolume(guildId);
	volumes![guildId] = volume;
	storage.save(volumesName, volumes);
}

export function volumePercent(volume: number): number {
	return Math.round(volume * 100);
}
