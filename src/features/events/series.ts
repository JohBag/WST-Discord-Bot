import { randomUUID } from 'crypto';
import type { Client } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import { load, save } from '../../core/storage.js';
import { createEvent, loadEvents } from './store.js';
import type { EventKind, RaidEvent } from './store.js';
import type { GameId } from './games.js';
import { fromWallClock, wallClock } from './when.js';

// A raid or event that repeats every week at the same server time, such as the Wednesday and Sunday
// raids. Each week's post goes up a week before it starts, so the next one is always open for
// sign-ups (decided 2026-11-15). An edit to one week's post changes that week only.

export interface Series {
	id: string;
	game: GameId;
	kind: EventKind;
	title: string;
	description: string;
	leaderId: string;
	leaderName: string;
	channelId: string;
	guildId?: string;
	// The start of the latest week posted. The next is 7 days on, at the same server time
	lastStart: number;
	active: boolean;
}

export type SeriesStore = Record<string, Series>;

const storeFile = 'event-series';
const week = 7 * 24 * 60 * 60 * 1000;

// A week on, at the same time on the server's clock, so a daylight saving change doesn't move it
export function weekAfter(start: number): number {
	const c = wallClock(start);
	return fromWallClock(c.year, c.month, c.day + 7, c.hour, c.minute);
}

// The starts to post now: each whose post-up time (a week before) has come and whose start is still
// ahead. Weeks whose start passed while Botty was offline are skipped
export function dueStarts(series: Series, now = Date.now()): number[] {
	const starts: number[] = [];
	for (let next = weekAfter(series.lastStart); next - week <= now; next = weekAfter(next)) {
		if (next > now) {
			starts.push(next);
		}
	}
	return starts;
}

// The newest week whose start has passed, which needs no post any more
export function passedWeek(series: Series, now = Date.now()): number {
	let last = series.lastStart;
	for (let next = weekAfter(last); next <= now; next = weekAfter(next)) {
		last = next;
	}
	return last;
}

export function seriesEvent(series: Series, start: number): RaidEvent {
	return {
		...createEvent({
			game: series.game,
			kind: series.kind,
			title: series.title,
			description: series.description,
			start,
			leaderId: series.leaderId,
			leaderName: series.leaderName,
			// The game's channel when one is set, so a change in config moves the series too
			channelId: config.events?.channels?.[series.game] || series.channelId,
			guildId: series.guildId,
		}),
		seriesId: series.id,
	};
}

export function createSeries(event: RaidEvent, id = randomUUID().slice(0, 8)): Series {
	return {
		id,
		game: event.game,
		kind: event.kind,
		title: event.title,
		description: event.description,
		leaderId: event.leaderId,
		leaderName: event.leaderName,
		channelId: event.channelId,
		guildId: event.guildId,
		lastStart: event.start,
		active: true,
	};
}

// Saved in the git-ignored config/event-series.json
export function loadSeries(): SeriesStore {
	return load<SeriesStore>(storeFile);
}

export function saveSeries(store: SeriesStore): void {
	save(storeFile, store);
}

// Weeks whose post failed, so the error is logged once rather than every minute
const failing = new Set<string>();

function moveOn(id: string, lastStart: number): void {
	const store = loadSeries();
	if (store[id] && store[id].lastStart < lastStart) {
		store[id].lastStart = lastStart;
		saveSeries(store);
	}
}

// On the timer: posts the weeks that are due. A week counts as posted only once its post is up, so a
// failed post (Discord down, a restart halfway) is tried again each minute until its start. A week
// that already has a post is never posted again. postEvent sends a post and saves the event
export async function postDueWeeks(client: Client, postEvent: (client: Client, event: RaidEvent) => Promise<string>, now = Date.now()): Promise<void> {
	for (const id of Object.keys(loadSeries())) {
		const series = loadSeries()[id];
		if (!series?.active) {
			continue;
		}
		// Weeks that passed without a post (Botty offline the whole week) are left behind
		moveOn(id, passedWeek(series, now));
		for (const start of dueStarts(loadSeries()[id], now)) {
			const key = `${id}:${start}`;
			const already = Object.values(loadEvents()).some(e => e.seriesId === id && e.start === start);
			if (!already) {
				try {
					await postEvent(client, seriesEvent(series, start));
					log(`Posted next week's ${series.title}`);
					failing.delete(key);
				} catch (error) {
					if (!failing.has(key)) {
						log.error(`Posting next week's ${series.title} failed, trying again each minute until its start: ${error}`);
						failing.add(key);
					}
					break;
				}
			}
			moveOn(id, start);
		}
	}
}
