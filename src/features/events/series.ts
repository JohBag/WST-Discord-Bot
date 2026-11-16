import { randomUUID } from 'crypto';
import type { Client } from 'discord.js';
import log from '../../core/log.js';
import { load, save } from '../../core/storage.js';
import { createEvent, loadEvents } from './store.js';
import type { EventKind, RaidEvent } from './store.js';
import type { GameId } from './games.js';
import { fromWallClock, wallClock } from './when.js';

// A raid or event that repeats every week at the same server time, such as the Wednesday and Sunday
// raids. Each week's post goes up a week before it starts, so the next one is always open for
// sign-ups (decided 2026-11-15). An edit changes one week, or that week and the later ones.

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
	// The weeks go up with the reminder switched off
	noReminder?: boolean;
}

export type SeriesStore = Record<string, Series>;

const storeFile = 'event-series';
const week = 7 * 24 * 60 * 60 * 1000;

// A week on, at the same time on the server's clock, so a daylight saving change doesn't move it
export function weekAfter(start: number): number {
	const c = wallClock(start);
	return fromWallClock(c.year, c.month, c.day + 7, c.hour, c.minute);
}

// Where a later week goes when one week moved from `from` to `to`: as many weeks after the new start
// as it was after the old one, so every later week takes the edited week's new day and time (moving
// Wednesday 19:30 to Thursday 20:00 makes every later week Thursday 20:00)
export function shiftLike(target: number, from: number, to: number): number {
	let weeks = Math.round((target - from) / week);
	let start = to;
	for (; weeks > 0; weeks--) {
		start = weekAfter(start);
	}
	return start;
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
			// Where the series was created
			channelId: series.channelId,
			guildId: series.guildId,
		}),
		seriesId: series.id,
		...(series.noReminder ? { noReminder: true } : {}),
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
		...(event.noReminder ? { noReminder: true } : {}),
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

// Moves lastStart on, but only from the value this pass read: an officer may have moved the series
// ("This and repeating events") while a post was being sent, and that wins. Returns whether it did
function moveOn(id: string, from: number, to: number): boolean {
	const store = loadSeries();
	if (!store[id] || store[id].lastStart !== from) {
		return false;
	}
	if (to > from) {
		store[id].lastStart = to;
		saveSeries(store);
	}
	return true;
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
		const passed = passedWeek(series, now);
		if (!moveOn(id, series.lastStart, passed)) {
			continue;
		}
		let from = Math.max(series.lastStart, passed);
		for (const start of dueStarts({ ...series, lastStart: from }, now)) {
			const key = `${id}:${start}`;
			const already = Object.values(loadEvents()).some(e => e.seriesId === id && e.start === start);
			if (!already) {
				try {
					// Read fresh, so a title just changed for later weeks is used
					await postEvent(client, seriesEvent(loadSeries()[id] ?? series, start));
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
			if (!moveOn(id, from, start)) {
				break;
			}
			from = start;
		}
	}
}
