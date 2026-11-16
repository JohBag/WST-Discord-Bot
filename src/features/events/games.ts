// The two games the guild raids in, with their classes, specs and the role column each spec signs
// up in. Retail is the current expansion (Midnight, 13 classes). WoW Forever is the vanilla-style
// version with 9 classes, where a few specs fill two roles.

export type GameId = 'retail' | 'forever';
export type Role = 'Tank' | 'Healer' | 'Melee' | 'Ranged';

export const roles: Role[] = ['Tank', 'Healer', 'Melee', 'Ranged'];

export interface Spec {
	id: string;
	name: string;
	// The role columns it can sign up in, the usual one first. Two means the sign-up asks which
	roles: Role[];
	// Raid-Helper's name for it, which the Raid-Helper Helper addon reads to tell the class.
	// Raid-Helper keeps names unique by numbering the second spec of a name (Frost1, Holy1)
	raidHelperName: string;
}

export interface WowClass {
	// WoW's own class token (DEATHKNIGHT), the same in both games
	id: string;
	name: string;
	specs: Spec[];
}

export interface Game {
	id: GameId;
	name: string;
	classes: WowClass[];
}

// The ID is saved with every character, so a spec's name can't change without moving saved ones
function spec(name: string, roles: Role[], raidHelperName = name.replace(/ /g, '')): Spec {
	return { id: name.toLowerCase().replace(/ /g, '-'), name, roles, raidHelperName };
}

const retail: Game = {
	id: 'retail',
	name: 'Retail',
	classes: [
		{ id: 'DEATHKNIGHT', name: 'Death Knight', specs: [spec('Blood', ['Tank']), spec('Frost', ['Melee'], 'Frost1'), spec('Unholy', ['Melee'])] },
		{ id: 'DEMONHUNTER', name: 'Demon Hunter', specs: [spec('Havoc', ['Melee']), spec('Vengeance', ['Tank']), spec('Devourer', ['Ranged'])] },
		{ id: 'DRUID', name: 'Druid', specs: [spec('Balance', ['Ranged']), spec('Feral', ['Melee']), spec('Guardian', ['Tank']), spec('Restoration', ['Healer'])] },
		{ id: 'EVOKER', name: 'Evoker', specs: [spec('Devastation', ['Ranged']), spec('Preservation', ['Healer']), spec('Augmentation', ['Ranged'])] },
		{ id: 'HUNTER', name: 'Hunter', specs: [spec('Beast Mastery', ['Ranged'], 'Beastmastery'), spec('Marksmanship', ['Ranged']), spec('Survival', ['Melee'])] },
		{ id: 'MAGE', name: 'Mage', specs: [spec('Arcane', ['Ranged']), spec('Fire', ['Ranged']), spec('Frost', ['Ranged'])] },
		{ id: 'MONK', name: 'Monk', specs: [spec('Brewmaster', ['Tank']), spec('Mistweaver', ['Healer']), spec('Windwalker', ['Melee'])] },
		{ id: 'PALADIN', name: 'Paladin', specs: [spec('Holy', ['Healer'], 'Holy1'), spec('Protection', ['Tank'], 'Protection1'), spec('Retribution', ['Melee'])] },
		{ id: 'PRIEST', name: 'Priest', specs: [spec('Discipline', ['Healer']), spec('Holy', ['Healer']), spec('Shadow', ['Ranged'])] },
		{ id: 'ROGUE', name: 'Rogue', specs: [spec('Assassination', ['Melee']), spec('Outlaw', ['Melee']), spec('Subtlety', ['Melee'])] },
		{ id: 'SHAMAN', name: 'Shaman', specs: [spec('Elemental', ['Ranged']), spec('Enhancement', ['Melee']), spec('Restoration', ['Healer'], 'Restoration1')] },
		{ id: 'WARLOCK', name: 'Warlock', specs: [spec('Affliction', ['Ranged']), spec('Demonology', ['Ranged']), spec('Destruction', ['Ranged'])] },
		{ id: 'WARRIOR', name: 'Warrior', specs: [spec('Arms', ['Melee']), spec('Fury', ['Melee']), spec('Protection', ['Tank'])] },
	],
};

// Roles per Warcraft Tavern's WoW Forever class guide (2026-11-15). Survival is listed there as
// melee, which is new for a vanilla-style hunter, so it offers both. Unverified in game.
const forever: Game = {
	id: 'forever',
	name: 'Forever',
	classes: [
		{ id: 'DRUID', name: 'Druid', specs: [spec('Balance', ['Ranged']), spec('Feral', ['Melee', 'Tank']), spec('Restoration', ['Healer'])] },
		{ id: 'HUNTER', name: 'Hunter', specs: [spec('Beast Mastery', ['Ranged'], 'Beastmastery'), spec('Marksmanship', ['Ranged']), spec('Survival', ['Melee', 'Ranged'])] },
		{ id: 'MAGE', name: 'Mage', specs: [spec('Arcane', ['Ranged']), spec('Fire', ['Ranged']), spec('Frost', ['Ranged'])] },
		{ id: 'PALADIN', name: 'Paladin', specs: [spec('Holy', ['Healer'], 'Holy1'), spec('Protection', ['Tank'], 'Protection1'), spec('Retribution', ['Melee'])] },
		{ id: 'PRIEST', name: 'Priest', specs: [spec('Discipline', ['Healer']), spec('Holy', ['Healer']), spec('Shadow', ['Ranged'])] },
		{ id: 'ROGUE', name: 'Rogue', specs: [spec('Assassination', ['Melee']), spec('Combat', ['Melee']), spec('Subtlety', ['Melee'])] },
		{ id: 'SHAMAN', name: 'Shaman', specs: [spec('Elemental', ['Ranged']), spec('Enhancement', ['Melee', 'Tank']), spec('Restoration', ['Healer'], 'Restoration1')] },
		{ id: 'WARLOCK', name: 'Warlock', specs: [spec('Affliction', ['Ranged']), spec('Demonology', ['Ranged']), spec('Destruction', ['Ranged'])] },
		{ id: 'WARRIOR', name: 'Warrior', specs: [spec('Arms', ['Melee']), spec('Fury', ['Melee']), spec('Protection', ['Tank'])] },
	],
};

export const games: Record<GameId, Game> = { retail, forever };
export const gameIds: GameId[] = ['retail', 'forever'];

export function isGameId(value: string): value is GameId {
	return value in games;
}

export function findClass(game: GameId, classId: string): WowClass | undefined {
	return games[game].classes.find(c => c.id === classId);
}

export function findSpec(game: GameId, classId: string, specId: string): Spec | undefined {
	return findClass(game, classId)?.specs.find(s => s.id === specId);
}
