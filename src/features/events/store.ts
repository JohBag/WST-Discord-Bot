import { randomUUID } from 'crypto';
import { load, save } from '../../core/storage.js';
import { findSpec, games } from './games.js';
import type { GameId, Role } from './games.js';
import type { Character } from './characters.js';

export type EventKind = 'raid' | 'event';
// Signed up and Late are in the roster. The rest are listed under it
export type SignupStatus = 'signed' | 'late' | 'tentative' | 'bench' | 'absence';

export interface Signup {
	userId: string;
	// Their server name when they answered, shown as plain text: a mention in a post can read as
	// "unknown user" on phones and takes three times the room
	displayName: string;
	status: SignupStatus;
	// Sign-up order, kept when the status or character changes
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
		role: Role;
	};
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
	// Raids: how many tanks and healers the leader wants, shown as 2/2
	targets: Partial<Record<Role, number>>;
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
	role: Role;
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
		for (const role of findSpec(character.game, character.classId, specId)?.roles ?? []) {
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
export function lastRole(store: EventStore, userId: string, characterId: string, specId: string): Role | undefined {
	let latest: Signup | undefined;
	for (const event of Object.values(store)) {
		for (const signup of event.signups) {
			if (signup.userId === userId && signup.character?.id === characterId && signup.character.specId === specId
				&& (!latest || signup.changedAt > latest.changedAt)) {
				latest = signup;
			}
		}
	}
	return latest?.character?.role;
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
		if (offSpec && character.offSpecId !== choice.specId && !offSpec.roles.includes(choice.role)) {
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

export function createEvent(fields: Pick<RaidEvent, 'game' | 'kind' | 'title' | 'description' | 'start' | 'leaderId' | 'leaderName' | 'channelId' | 'targets'>, now = Date.now(), id = randomUUID().slice(0, 8)): RaidEvent {
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

// Saved in the git-ignored config/events.json
export function loadEvents(): EventStore {
	return load<EventStore>(storeFile);
}

export function saveEvents(store: EventStore): void {
	save(storeFile, store);
}
