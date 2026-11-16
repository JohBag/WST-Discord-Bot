import { GuildScheduledEventStatus } from 'discord.js';
import type { Client, GuildMember, GuildScheduledEvent, PartialGuildScheduledEvent, User } from 'discord.js';
import log from '../../core/log.js';
import { guildOf, postUrl } from './calendar.js';
import { homeRealm } from './character-panel.js';
import { characterName, charactersOf, gameName, loadCharacters } from './characters.js';
import type { Character } from './characters.js';
import { updatePost } from './event-actions.js';
import { findClass, findSpec, signupRolesOf } from './games.js';
import { lastRole, loadEvents, respond, saveEvents, signupChoices, withdraw } from './store.js';
import type { EventStore, RaidEvent, SignupChoice, SignupStatus } from './store.js';

// Clicking Interested on an event's entry in the Events tab signs the member up on the post, and
// unclicking takes back a sign-up that came from there (decided 2026-11-16). Bots can't mark anyone
// Interested, so it only goes this way. The member gets a direct message saying what happened,
// with a link to the post: a private reply needs a click on Botty's own buttons, which this isn't.
// Clicks made while Botty was offline are caught up at startup.

type Entry = GuildScheduledEvent | PartialGuildScheduledEvent;

function eventFor(store: EventStore, calendarId: string): RaidEvent | undefined {
	return Object.values(store).find(event => event.calendarId === calendarId);
}

// One member's clicks on one entry are handled in order, so a quick click and unclick can't finish
// the wrong way round
const queues = new Map<string, Promise<void>>();

// Clicks seen live since startup. The catch-up works from a list fetched once, so it leaves these alone
const seenLive = new Set<string>();

function inOrder(key: string, work: () => Promise<void>): Promise<void> {
	const next = (queues.get(key) ?? Promise.resolve()).then(work).catch(error => log.error(`Interested ${key}: ${error}`));
	queues.set(key, next);
	return next;
}

// The main's own spec, in the role that character last signed up as, else the spec's usual role.
// There is no one to ask here, so a two-role spec isn't asked
export function interestChoice(store: EventStore, userId: string, characters: Character[]): SignupChoice | undefined {
	const main = characters.find(c => c.main) ?? characters[0];
	if (!main) {
		return undefined;
	}
	const spec = findSpec(main.game, main.classId, main.specId);
	if (!spec) {
		// A saved spec the game data no longer has: any spec of theirs rather than none
		return signupChoices(characters)[0];
	}
	const roles = signupRolesOf(spec);
	const remembered = lastRole(store, userId, main.id, spec.id);
	return { character: main, specId: spec.id, role: remembered && roles.includes(remembered) ? remembered : roles[0] };
}

const standing: Record<SignupStatus, string> = {
	signed: 'signed up',
	late: 'down as Late',
	tentative: 'down as Tentative',
	absence: 'down as Absent',
};

async function tell(user: User, lines: string[]): Promise<void> {
	await user.send({ content: lines.join('\n'), allowedMentions: { parse: [] } })
		.catch(error => log.warn(`Couldn't message ${user.username ?? user.id}: ${error}`));
}

function linkLine(event: RaidEvent, guildId: string, text: string): string {
	const link = postUrl(event, guildId);
	return link ? `${text}: ${link}` : `${text}.`;
}

// Signs the member up unless they already answered, and tells them either way
// quietWithout: the startup catch-up, which would otherwise repeat "no character saved" after every restart
async function signUp(client: Client, guildId: string, calendarId: string, user: User, member: GuildMember | null, quietWithout = false): Promise<void> {
	const store = loadEvents();
	const event = eventFor(store, calendarId);
	if (!event || event.cancelled || event.closed) {
		return;
	}
	const existing = event.signups.find(s => s.userId === user.id);
	if (existing) {
		// Their own answer stands
		const where = event.kind === 'event' && existing.status === 'signed' ? 'marked as attending' : standing[existing.status];
		await tell(user, [`You're ${where} for **${event.title}**.`, linkLine(event, guildId, 'Change it on the post')]);
		return;
	}
	const name = member?.displayName ?? user.globalName ?? user.username;
	if (event.kind === 'event') {
		respond(event, user.id, name, 'signed').viaInterest = calendarId;
		saveEvents(store);
		log(`${user.username} signed up for ${event.title} by clicking Interested`);
		await updatePost(client, event.id);
		await tell(user, [`Marked as attending **${event.title}**, since you clicked Interested.`, linkLine(event, guildId, 'Change or withdraw on the post')]);
		return;
	}
	const choice = interestChoice(store, user.id, charactersOf(loadCharacters(), user.id, event.game));
	if (!choice) {
		// A raid sign-up needs a character, which only the post can add
		if (quietWithout) {
			return;
		}
		await tell(user, [`Not signed up for **${event.title}** yet: no ${gameName(event.game)} character saved.`, linkLine(event, guildId, 'Sign up on the post')]);
		return;
	}
	respond(event, user.id, name, 'signed', choice).viaInterest = calendarId;
	saveEvents(store);
	log(`${user.username} signed up for ${event.title} by clicking Interested`);
	await updatePost(client, event.id);
	const what = `${findSpec(event.game, choice.character.classId, choice.specId)?.name} ${findClass(event.game, choice.character.classId)?.name} (${choice.role})`;
	await tell(user, [
		`Signed up for **${event.title}** as **${characterName(choice.character, homeRealm(event.game))}**, ${what}, since you clicked Interested.`,
		linkLine(event, guildId, 'Change or withdraw on the post'),
	]);
}

// Takes back a sign-up only if Interested made it and it hasn't been changed on the post since
async function takeBack(client: Client, guildId: string, calendarId: string, user: User): Promise<void> {
	const store = loadEvents();
	const event = eventFor(store, calendarId);
	if (!event || event.cancelled || event.closed || event.signups.find(s => s.userId === user.id)?.viaInterest !== calendarId) {
		return;
	}
	withdraw(event, user.id);
	saveEvents(store);
	log(`${user.username ?? user.id} withdrew from ${event.title} by unclicking Interested`);
	await updatePost(client, event.id);
	await tell(user, [`Your sign-up for **${event.title}** is withdrawn, since you're no longer interested.`, linkLine(event, guildId, 'Sign up again on the post')]);
}

export function onInterested(entry: Entry, user: User): Promise<void> {
	seenLive.add(`${entry.id}:${user.id}`);
	return inOrder(`${entry.id}:${user.id}`, async () => {
		// The member gives a full user (for .bot and the name) even when the click came with only an ID
		const member = await entry.guild?.members.fetch(user.id).catch(() => null) ?? null;
		const full = member?.user ?? (user.partial ? await user.fetch().catch(() => null) : user);
		if (!full || full.bot) {
			return;
		}
		await signUp(entry.client, entry.guildId, entry.id, full, member);
	});
}

export function onNotInterested(entry: Entry, user: User): Promise<void> {
	seenLive.add(`${entry.id}:${user.id}`);
	return inOrder(`${entry.id}:${user.id}`, async () => {
		// An entry that has ended or been cancelled isn't a member changing their mind
		if (!entry.partial && entry.status !== GuildScheduledEventStatus.Scheduled && entry.status !== GuildScheduledEventStatus.Active) {
			return;
		}
		await takeBack(entry.client, entry.guildId, entry.id, user);
	});
}

// At startup: Interested clicks made while Botty was offline, both ways, as if they had just happened
export async function catchUpInterest(client: Client, now = Date.now()): Promise<void> {
	for (const id of Object.keys(loadEvents())) {
		const event = loadEvents()[id];
		if (!event?.calendarId || event.cancelled || event.closed || event.start <= now) {
			continue;
		}
		const calendarId = event.calendarId;
		try {
			const guild = await guildOf(client, event);
			if (!guild) {
				continue;
			}
			// 100 is the most Discord gives in one go, plenty for a raid
			const subscribers = await guild.scheduledEvents.fetchSubscribers(calendarId, { withMember: true, limit: 100 });
			const interested = new Set<string>();
			for (const { user, member } of subscribers.values()) {
				interested.add(user.id);
				const key = `${calendarId}:${user.id}`;
				if (!user.bot && !seenLive.has(key) && !event.signups.some(s => s.userId === user.id)) {
					await inOrder(key, () => signUp(client, guild.id, calendarId, user, member ?? null, true));
				}
			}
			// With a full page there may be more, so nobody is taken back on the strength of it
			if (subscribers.size >= 100) {
				continue;
			}
			for (const signup of event.signups.filter(s => s.viaInterest === calendarId && !interested.has(s.userId))) {
				const key = `${calendarId}:${signup.userId}`;
				const user = seenLive.has(key) ? null : await client.users.fetch(signup.userId).catch(() => null);
				if (user) {
					await inOrder(key, () => takeBack(client, guild.id, calendarId, user));
				}
			}
		} catch (error) {
			log.error(`Catching up Interested clicks for ${event.title} failed: ${error}`);
		}
	}
}
