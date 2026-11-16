import { randomUUID } from 'crypto';
import { load, save } from '../../core/storage.js';
import { findSpec, games, signupRoleOf, signupRolesOf } from './games.js';
import type { GameId, SignupRole } from './games.js';
import type { Character } from './characters.js';

export type EventKind = 'raid' | 'event';
// Signed up and Late are in the roster. Tentative and Absent are listed under it
export type SignupStatus = 'signed' | 'late' | 'tentative' | 'absence';

export interface Signup {
	userId: string;
	// Their server name when they answered, shown as plain text: a mention in a post can read as
	// "unknown user" on phones and takes three times the room
	displayName: string;
	status: SignupStatus;
	// Answering order, kept when the status or character changes. The post shows each answer's place
	// in this order among the answers still there
	number: number;
	// Raids: the character, spec and role. A copy, so the post still reads right if the character
	// is removed later
	character?: {
		id: string;
		name: string;
		realm: string;
		classId: string;
		specId: string;
		offSpecId?: string;
		role: SignupRole;
	};
	// The Events tab entry whose Interested made this sign-up, while it hasn't been changed on the post
	// since. Unclicking Interested on that same entry is the only thing that takes it back: a
	// replacement entry starts with no one interested
	viaInterest?: string;
	changedAt: number;
}

export interface RaidEvent {
	id: string;
	game: GameId;
	kind: EventKind;
	title: string;
	description: string;
	start: number;
	leaderId: string;
	leaderName: string;
	channelId: string;
	messageId?: string;
	// The server, and the event's entry in its Events tab
	guildId?: string;
	calendarId?: string;
	// The weekly series this week's post belongs to
	seriesId?: string;
	// The hour-before reminder has gone out
	reminded?: boolean;
	// That night's log on Warcraft Logs, once the auto-post found it, and how much of the raid it covers
	logUrl?: string;
	logOverlap?: number;
	closed: boolean;
	// Who closed sign-ups: the start passing, or an officer. Moving the start later only undoes the first
	closedBy?: 'start' | 'officer';
	// Sign-ups close by themselves at the start, once. An officer can open them again after
	autoClosed: boolean;
	cancelled: boolean;
	signups: Signup[];
	nextNumber: number;
	createdAt: number;
}

export type EventStore = Record<string, RaidEvent>;

const storeFile = 'events';

// What a sign-up can be made as: a character, one of its class's specs, and a role that spec fills
export interface SignupChoice {
	character: Character;
	specId: string;
	role: SignupRole;
}

export function choiceValue(choice: SignupChoice): string {
	return `${choice.character.id}|${choice.specId}|${choice.role}`;
}

// Every way a member can sign up for a raid, best guess first: each character's spec and off-spec
// (the main first), then their other specs, so every alt is in reach within Discord's 25 menu
// options. Specs that fill two roles appear once per role
export function signupChoices(characters: Character[]): SignupChoice[] {
	const ordered = [...characters].sort((a, b) => Number(b.main) - Number(a.main));
	const add = (list: SignupChoice[], character: Character, specId: string) => {
		const spec = findSpec(character.game, character.classId, specId);
		for (const role of spec ? signupRolesOf(spec) : []) {
			list.push({ character, specId, role });
		}
	};
	const saved: SignupChoice[] = [];
	const others: SignupChoice[] = [];
	for (const character of ordered) {
		add(saved, character, character.specId);
		if (character.offSpecId) {
			add(saved, character, character.offSpecId);
		}
		const wowClass = games[character.game].classes.find(c => c.id === character.classId);
		for (const spec of wowClass?.specs ?? []) {
			if (spec.id !== character.specId && spec.id !== character.offSpecId) {
				add(others, character, spec.id);
			}
		}
	}
	return [...saved, ...others].slice(0, 25);
}

// The role a character last signed up as with a spec, in any event, for specs that fill two roles
export function lastRole(store: EventStore, userId: string, characterId: string, specId: string): SignupRole | undefined {
	let latest: Signup | undefined;
	for (const event of Object.values(store)) {
		for (const signup of event.signups) {
			if (signup.userId === userId && signup.character?.id === characterId && signup.character.specId === specId
				&& (!latest || signup.changedAt > latest.changedAt)) {
				latest = signup;
			}
		}
	}
	return latest?.character ? signupRoleOf(latest.character.role) : undefined;
}

export function findChoice(characters: Character[], value: string): SignupChoice | undefined {
	return signupChoices(characters).find(choice => choiceValue(choice) === value);
}

// Sets a member's answer. A raid's Signed up and Late need a character. Without one given, an
// earlier sign-up's character stays
export function respond(event: RaidEvent, userId: string, displayName: string, status: SignupStatus, choice?: SignupChoice, now = Date.now()): Signup {
	let signup = event.signups.find(s => s.userId === userId);
	if (!signup) {
		signup = { userId, displayName, status, number: event.nextNumber++, changedAt: now };
		event.signups.push(signup);
	}
	signup.displayName = displayName;
	signup.status = status;
	// An answer on the post is the member's own, even if Interested made the sign-up
	delete signup.viaInterest;
	signup.changedAt = now;
	if (choice) {
		const { character } = choice;
		signup.character = {
			id: character.id,
			name: character.name,
			realm: character.realm,
			classId: character.classId,
			specId: choice.specId,
			role: choice.role,
		};
		// The off-spec shows on the line only when it adds a role they didn't sign up as
		const offSpec = character.offSpecId ? findSpec(character.game, character.classId, character.offSpecId) : undefined;
		if (offSpec && character.offSpecId !== choice.specId && signupRolesOf(offSpec).some(role => role !== choice.role)) {
			signup.character.offSpecId = character.offSpecId;
		}
	}
	return signup;
}

export function withdraw(event: RaidEvent, userId: string): boolean {
	const before = event.signups.length;
	event.signups = event.signups.filter(s => s.userId !== userId);
	return event.signups.length < before;
}

export function createEvent(fields: Pick<RaidEvent, 'game' | 'kind' | 'title' | 'description' | 'start' | 'leaderId' | 'leaderName' | 'channelId'> & { guildId?: string }, now = Date.now(), id = randomUUID().slice(0, 8)): RaidEvent {
	return {
		id,
		...fields,
		closed: false,
		autoClosed: false,
		cancelled: false,
		signups: [],
		nextNumber: 1,
		createdAt: now,
	};
}

// Saved in the git-ignored config/events.json. Events saved by the first version are read in
// today's terms: Bench became Tentative, and role targets are gone
export function loadEvents(): EventStore {
	const store = load<EventStore>(storeFile);
	for (const event of Object.values(store)) {
		delete (event as { targets?: unknown }).targets;
		for (const signup of event.signups) {
			if ((signup.status as string) === 'bench') {
				signup.status = 'tentative';
			}
		}
	}
	return store;
}

export function saveEvents(store: EventStore): void {
	save(storeFile, store);
}
