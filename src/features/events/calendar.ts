import { DiscordAPIError, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus, RESTJSONErrorCodes } from 'discord.js';
import type { Client, Guild } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import { loadEvents, saveEvents } from './store.js';
import type { EventKind, RaidEvent } from './store.js';

// Each post's entry in the server's Events tab, where members click Interested. Botty creates it
// with the post and keeps its title, time and description in step. Discord itself starts the entry
// at its start, which sends the notification to those interested, and completes it at its end.
// Botty asks Discord how the entry stands before each change rather than keeping its own copy.

const defaultMinutes = 120;

export function durationMinutes(kind: EventKind): number {
	return config.events?.durationMinutes?.[kind] ?? defaultMinutes;
}

export function endOf(event: RaidEvent): number {
	return event.start + durationMinutes(event.kind) * 60 * 1000;
}

export function postUrl(event: RaidEvent, guildId: string): string | undefined {
	return event.messageId ? `https://discord.com/channels/${guildId}/${event.channelId}/${event.messageId}` : undefined;
}

// How the entry stands in Discord: none when there is no entry or it was removed by hand
export type EntryStatus = 'none' | 'scheduled' | 'active' | 'over';

export type CalendarStep = 'create' | 'update' | 'update-details' | 'restart' | 'cancel' | 'complete' | 'none';

// What a change to the event (created, edited, cancelled) needs from the entry
export function syncStep(event: RaidEvent, status: EntryStatus, now = Date.now()): CalendarStep {
	if (event.cancelled) {
		return status === 'scheduled' ? 'cancel' : status === 'active' ? 'complete' : 'none';
	}
	if (status === 'none' || status === 'over') {
		// A new entry can only start in the future, so an event that has begun gets none
		return event.start > now ? 'create' : 'none';
	}
	if (status === 'active') {
		// Moved to later after it started: the live entry ends and a new one waits for the new start
		return event.start > now ? 'restart' : 'update-details';
	}
	return 'update';
}

// The entry's details. An empty description is sent as null, since leaving it out keeps the old one
export function calendarDetails(event: RaidEvent, guildId: string) {
	return {
		name: event.title,
		description: (event.description || null) as string,
		scheduledStartTime: new Date(event.start),
		scheduledEndTime: new Date(endOf(event)),
		entityMetadata: { location: postUrl(event, guildId) ?? 'Discord' },
	};
}

// Saves the entry's ID into a fresh read of the events (the Discord call took a while, and answers
// saved meanwhile must stay), and only if the event still points at the entry this step acted on
function saveLink(eventId: string, id: string | undefined, expected: string | undefined): void {
	const store = loadEvents();
	const event = store[eventId];
	if (!event || event.calendarId !== expected) {
		return;
	}
	if (id) {
		event.calendarId = id;
	} else {
		delete event.calendarId;
	}
	saveEvents(store);
}

function isGone(error: unknown): boolean {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownGuildScheduledEvent;
}

// The server the post is in
export async function guildOf(client: Client, event: RaidEvent): Promise<Guild | null> {
	if (event.guildId) {
		return client.guilds.fetch(event.guildId).catch(() => null);
	}
	const channel = await client.channels.fetch(event.channelId).catch(() => null);
	return channel && 'guild' in channel ? channel.guild : null;
}

async function entryOf(guild: Guild, id: string | undefined) {
	if (!id) {
		return null;
	}
	try {
		// Forced: a cached copy can be out of date, or empty when it only arrived with an Interested click
		return await guild.scheduledEvents.fetch({ guildScheduledEvent: id, force: true });
	} catch (error) {
		if (isGone(error)) {
			return null;
		}
		throw error;
	}
}

function statusOf(entry: Awaited<ReturnType<typeof entryOf>>): EntryStatus {
	if (!entry) {
		return 'none';
	}
	if (entry.status === GuildScheduledEventStatus.Scheduled) {
		return 'scheduled';
	}
	return entry.status === GuildScheduledEventStatus.Active ? 'active' : 'over';
}

async function create(guild: Guild, event: RaidEvent, replacing: string | undefined): Promise<void> {
	const created = await guild.scheduledEvents.create({
		...calendarDetails(event, guild.id),
		// Null clears a description on an edit. A new entry simply goes without
		description: event.description || undefined,
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		entityType: GuildScheduledEventEntityType.External,
	});
	saveLink(event.id, created.id, replacing);
	// Cancelled by another officer while the entry was being made: it mustn't go live
	const now = loadEvents()[event.id];
	if (!now || now.cancelled || now.calendarId !== created.id) {
		await guild.scheduledEvents.edit(created.id, { status: GuildScheduledEventStatus.Canceled }).catch(() => {});
	}
}

// onlyCreate: the startup pass, which adds missing entries and leaves the rest alone
async function run(client: Client, event: RaidEvent, onlyCreate = false): Promise<CalendarStep> {
	const guild = await guildOf(client, event);
	if (!guild) {
		throw new Error(`no server found for event ${event.id}`);
	}
	const entry = await entryOf(guild, event.calendarId);
	const step = syncStep(event, statusOf(entry));
	if (onlyCreate && step !== 'create') {
		return 'none';
	}
	const id = entry?.id;
	const details = calendarDetails(event, guild.id);
	switch (step) {
		case 'create':
			await create(guild, event, event.calendarId);
			break;
		case 'update': {
			// The start is only sent when it moved, so an edit just after the start isn't refused
			const { scheduledStartTime, ...rest } = details;
			const moved = entry!.scheduledStartTimestamp !== event.start;
			await guild.scheduledEvents.edit(id!, moved ? details : rest);
			break;
		}
		case 'update-details': {
			const { name, description, scheduledEndTime } = details;
			await guild.scheduledEvents.edit(id!, { name, description, scheduledEndTime });
			break;
		}
		case 'restart':
			// Discord may have ended it meanwhile: the new entry is what matters
			await guild.scheduledEvents.edit(id!, { status: GuildScheduledEventStatus.Completed })
				.catch(error => log.warn(`Ending the old entry for ${event.title} failed: ${error}`));
			await create(guild, event, event.calendarId);
			break;
		case 'cancel':
			await guild.scheduledEvents.edit(id!, { status: GuildScheduledEventStatus.Canceled });
			break;
		case 'complete':
			await guild.scheduledEvents.edit(id!, { status: GuildScheduledEventStatus.Completed });
			break;
	}
	return step;
}

// After creating, editing or cancelling. Returns a line for the officer when it failed, else nothing
export async function syncCalendar(client: Client, event: RaidEvent): Promise<string | undefined> {
	try {
		await run(client, event);
		return undefined;
	} catch (error) {
		log.error(`Events tab entry for ${event.title} failed: ${error}`);
		if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
			return "I couldn't update the server's Events tab: I need the Create Events permission.";
		}
		return "I couldn't update the server's Events tab.";
	}
}

// At startup: upcoming events whose entry is missing get one, such as those posted before the Events
// tab was added, while it failed, or whose entry was removed by hand. Entries that are fine are left
export async function addMissingEntries(client: Client, now = Date.now()): Promise<void> {
	for (const id of Object.keys(loadEvents())) {
		// Read fresh each time: an officer may have edited it while earlier ones were being checked
		const event = loadEvents()[id];
		if (!event || event.cancelled || event.start <= now || !event.messageId) {
			continue;
		}
		try {
			await run(client, event, true);
		} catch (error) {
			log.error(`Events tab entry for ${event.title} failed: ${error}`);
		}
	}
}
