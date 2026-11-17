import { randomUUID } from 'crypto';
import { load, save } from '../../core/storage.js';
import { euRealms } from './eu-realms.js';
import { findClass, findSpec, games } from './games.js';
import type { GameId } from './games.js';

// A member's saved character. Sign-ups point at one, so the export carries the name to invite
export interface Character {
	id: string;
	game: GameId;
	name: string;
	// The realm's official name (Der Rat von Dalaran). Empty for Forever, which has no realms
	realm: string;
	classId: string;
	specId: string;
	offSpecId?: string;
	// One per game: what a sign-up uses in one click
	main: boolean;
}

// What a member types or picks in the character form
export interface CharacterInput {
	game: GameId;
	name: string;
	realm: string;
	classId: string;
	specId: string;
	offSpecId?: string;
}

// Saved characters by Discord user ID
export type CharacterStore = Record<string, Character[]>;

export const maxCharactersPerGame = 10;
const storeFile = 'characters';

type Result<T> = T | { error: string };

// Longest name the form takes: Forever's first and last name of 12 letters each, and the space
export function maxNameLength(game: GameId): number {
	return game === 'forever' ? 25 : 12;
}

// WoW names are 2 to 12 letters, capitalised, with the rest in lower case. Forever characters have a
// first and a last name, each following that rule (Thorvik Stonefist)
export function normalizeName(raw: string, game: GameId = 'retail'): Result<string> {
	const parts = raw.trim().split(/\s+/);
	const valid = parts.every(part => /^\p{L}{2,12}$/u.test(part));
	if (game === 'forever' && (parts.length !== 2 || !valid)) {
		return { error: 'Forever names are a first and a last name, 2 to 12 letters each.' };
	}
	if (game === 'retail' && (parts.length !== 1 || !valid)) {
		return { error: 'Character names are 2 to 12 letters, with no spaces.' };
	}
	return parts.map(part => part[0].toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

// Realms compare without case, accents, spaces or punctuation (festung der sturme finds Festung der Stürme)
export function realmKey(realm: string): string {
	return realm.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');
}

const realmsByKey = new Map<string, string>();
for (const [name, englishName] of euRealms) {
	realmsByKey.set(realmKey(name), name);
	if (englishName) {
		realmsByKey.set(realmKey(englishName), name);
	}
}

// Finds the EU realm that was meant, however it was typed, and returns its official name. The addon
// skips anyone whose realm it doesn't know, so only real realms are accepted
export function findRealm(raw: string): Result<string> {
	const realm = realmsByKey.get(realmKey(raw));
	if (!realm) {
		const typed = raw.trim();
		return { error: typed ? `There's no EU realm called ${typed}.` : 'Type your realm.' };
	}
	return realm;
}

// The realm as the game writes it after a name, without spaces or hyphens (Name-DerRatvonDalaran)
export function realmForInvite(realm: string): string {
	return realm.replace(/[\s-]/g, '');
}

// Name, plus the realm when it isn't the guild's own
export function characterName(character: { name: string; realm: string }, homeRealm: string): string {
	return !character.realm || realmKey(character.realm) === realmKey(homeRealm)
		? character.name
		: `${character.name}-${realmForInvite(character.realm)}`;
}

// "Blood Death Knight", with the off-spec in brackets when there is one
export function describeCharacter(character: Pick<Character, 'game' | 'classId' | 'specId' | 'offSpecId'>): string {
	const wowClass = findClass(character.game, character.classId);
	const spec = findSpec(character.game, character.classId, character.specId);
	const offSpec = character.offSpecId ? findSpec(character.game, character.classId, character.offSpecId) : undefined;
	const main = `${spec?.name ?? '?'} ${wowClass?.name ?? '?'}`;
	return offSpec ? `${main} (off-spec ${offSpec.name})` : main;
}

// A member's characters, main first in each game, then by name
export function charactersOf(store: CharacterStore, userId: string, game?: GameId): Character[] {
	return (store[userId] ?? [])
		.filter(c => !game || c.game === game)
		.sort((a, b) => (a.game === b.game ? 0 : a.game === 'retail' ? -1 : 1)
			|| Number(b.main) - Number(a.main)
			|| a.name.localeCompare(b.name));
}

function sameCharacter(a: { game: GameId; name: string; realm: string }, b: { game: GameId; name: string; realm: string }): boolean {
	return a.game === b.game && a.name.toLowerCase() === b.name.toLowerCase() && realmKey(a.realm) === realmKey(b.realm);
}

function findOwner(store: CharacterStore, character: { game: GameId; name: string; realm: string }, exceptId?: string): string | undefined {
	return Object.keys(store).find(userId => store[userId].some(c => c.id !== exceptId && sameCharacter(c, character)));
}

// Checks and tidies what was typed, and finds out whether it clashes with a saved character
function validate(store: CharacterStore, userId: string, input: CharacterInput, exceptId?: string): Result<CharacterInput> {
	const name = normalizeName(input.name, input.game);
	if (typeof name !== 'string') {
		return name;
	}
	// Forever has no realms
	const realm = input.game === 'retail' ? findRealm(input.realm) : '';
	if (typeof realm !== 'string') {
		return realm;
	}
	if (!findSpec(input.game, input.classId, input.specId)) {
		return { error: 'Pick a spec.' };
	}
	if (input.offSpecId && !findSpec(input.game, input.classId, input.offSpecId)) {
		return { error: 'Pick an off-spec, or None.' };
	}
	if (input.offSpecId === input.specId) {
		return { error: 'Pick an off-spec other than your spec, or None.' };
	}
	const tidy: CharacterInput = { game: input.game, name, realm, classId: input.classId, specId: input.specId, offSpecId: input.offSpecId };

	const owner = findOwner(store, tidy, exceptId);
	const label = realm ? `${name} (${realm})` : name;
	if (owner === userId) {
		return { error: `${label} is already saved.` };
	}
	if (owner) {
		// A mention reads as their name. Whoever holds it, or an officer, can remove it
		return { error: `${label} is saved by <@${owner}>. Ask them or an officer to remove it.` };
	}
	return tidy;
}

export function addCharacter(store: CharacterStore, userId: string, input: CharacterInput, id: string = randomUUID().slice(0, 8)): Result<Character> {
	const sameGame = charactersOf(store, userId, input.game);
	if (sameGame.length >= maxCharactersPerGame) {
		return { error: `You can save up to ${maxCharactersPerGame} characters per game.` };
	}
	const tidy = validate(store, userId, input);
	if ('error' in tidy) {
		return tidy;
	}
	const character: Character = { id, ...tidy, main: sameGame.length === 0 };
	if (!character.offSpecId) {
		delete character.offSpecId;
	}
	store[userId] = [...(store[userId] ?? []), character];
	return character;
}

// Changes name, realm, spec or off-spec. The game and class stay
export function updateCharacter(store: CharacterStore, userId: string, id: string, input: Omit<CharacterInput, 'game' | 'classId'>): Result<Character> {
	const character = store[userId]?.find(c => c.id === id);
	if (!character) {
		return { error: 'That character is no longer saved.' };
	}
	const tidy = validate(store, userId, { ...input, game: character.game, classId: character.classId }, id);
	if ('error' in tidy) {
		return tidy;
	}
	character.name = tidy.name;
	character.realm = tidy.realm;
	character.specId = tidy.specId;
	if (tidy.offSpecId) {
		character.offSpecId = tidy.offSpecId;
	} else {
		delete character.offSpecId;
	}
	return character;
}

// Removes a character. When it was the main, the next one in that game takes over and is returned
export function removeCharacter(store: CharacterStore, userId: string, id: string): Result<{ removed: Character; newMain?: Character }> {
	const removed = store[userId]?.find(c => c.id === id);
	if (!removed) {
		return { error: 'That character is no longer saved.' };
	}
	store[userId] = store[userId].filter(c => c.id !== id);
	let newMain: Character | undefined;
	if (removed.main) {
		newMain = charactersOf(store, userId, removed.game)[0];
		if (newMain) {
			newMain.main = true;
		}
	}
	if (store[userId].length === 0) {
		delete store[userId];
	}
	return { removed, newMain };
}

export function setMain(store: CharacterStore, userId: string, id: string): Result<Character> {
	const character = store[userId]?.find(c => c.id === id);
	if (!character) {
		return { error: 'That character is no longer saved.' };
	}
	for (const other of store[userId]) {
		if (other.game === character.game) {
			other.main = other.id === id;
		}
	}
	return character;
}

export function gameName(game: GameId): string {
	return games[game].name;
}

// Saved in the git-ignored config/characters.json
export function loadCharacters(): CharacterStore {
	return load<CharacterStore>(storeFile);
}

export function saveCharacters(store: CharacterStore): void {
	save(storeFile, store);
}
