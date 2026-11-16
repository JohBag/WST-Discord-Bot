import type { Client } from 'discord.js';
import log from '../../core/log.js';
import { endOf } from './calendar.js';
import { loadEvents, saveEvents } from './store.js';
import type { EventStore, RaidEvent } from './store.js';

// When the Warcraft Logs auto-post finds a raid night, the retail raid post it belongs to links to
// that night's log. Only retail: Botty reads the guild's logs on www.warcraftlogs.com, and WoW
// Forever's logs aren't there.

export interface LoggedNight {
	code: string;
	startTime: number;
	endTime: number;
}

const margin = 60 * 60 * 1000;

export function logUrl(code: string): string {
	return `https://www.warcraftlogs.com/reports/${code}/`;
}

// How much of the raid's time, give or take an hour, the log covers
export function overlap(event: RaidEvent, night: LoggedNight): number {
	return Math.max(0, Math.min(night.endTime, endOf(event) + margin) - Math.max(night.startTime, event.start - margin));
}

// The retail raid whose time the log overlaps, give or take an hour, the closest start first
export function eventForLog(store: EventStore, night: LoggedNight): RaidEvent | undefined {
	return Object.values(store)
		.filter(event => event.game === 'retail' && event.kind === 'raid' && !event.cancelled
			&& night.startTime < endOf(event) + margin && night.endTime > event.start - margin)
		.sort((a, b) => Math.abs(a.start - night.startTime) - Math.abs(b.start - night.startTime))[0];
}

// Called by the auto-post for each raid night it handles. updatePost redraws the sign-up post
export async function linkLog(client: Client, night: LoggedNight, updatePost: (client: Client, eventId: string) => Promise<void>): Promise<void> {
	const store = loadEvents();
	const event = eventForLog(store, night);
	const url = logUrl(night.code);
	if (!event || event.logUrl === url) {
		return;
	}
	// Two logs near one raid (a crashed logger, an alt run before it): the one covering more of the
	// raid keeps the link, so it doesn't switch back and forth on every poll
	const covered = overlap(event, night);
	if (event.logUrl && (event.logOverlap ?? 0) >= covered) {
		return;
	}
	event.logUrl = url;
	event.logOverlap = covered;
	saveEvents(store);
	log(`Linked ${event.title} to log ${night.code}`);
	await updatePost(client, event.id);
}
