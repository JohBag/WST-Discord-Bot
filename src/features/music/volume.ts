import { config } from '../../core/config.js';
import * as storage from '../../core/storage.js';

// The levels the panel's volume buttons step through
export const volumeSteps = [0.1, 0.15, 0.25, 0.4, 0.6];
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

// The next step quieter or louder, or null at either end. A volume between steps moves to the nearest one.
export function stepVolume(volume: number, direction: 'quieter' | 'louder'): number | null {
	const next = direction === 'louder'
		? volumeSteps.find(step => step > volume)
		: [...volumeSteps].reverse().find(step => step < volume);
	return next ?? null;
}

export function volumeLabel(volume: number): string {
	return `${Math.round(volume * 100)}%`;
}
