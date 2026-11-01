import { config } from '../../core/config.js';
import * as storage from '../../core/storage.js';

// The levels in the panel's volume menu, in percent
export const volumeLevels = Array.from({ length: 20 }, (_, i) => i + 1);
// Kept per guild so a restart doesn't reset it; git-ignored, in config/
const volumesName = 'music-volumes';

let volumes: Record<string, number> | null = null;

// The panel's setting, else music.volume from the config
export function getVolume(guildId: string): number {
	volumes ??= storage.exists(volumesName) ? storage.load<Record<string, number>>(volumesName) : {};
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
