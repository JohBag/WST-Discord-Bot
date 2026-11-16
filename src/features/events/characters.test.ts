import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	addCharacter,
	characterName,
	charactersOf,
	describeCharacter,
	findRealm,
	normalizeName,
	removeCharacter,
	setMain,
	updateCharacter,
} from './characters.js';
import type { CharacterInput, CharacterStore } from './characters.js';
import { games } from './games.js';

const blood: CharacterInput = { game: 'retail', name: 'thorvik', realm: 'argent dawn', classId: 'DEATHKNIGHT', specId: 'blood', offSpecId: 'frost' };
const rogue: CharacterInput = { game: 'retail', name: 'Kapi', realm: 'Argent Dawn', classId: 'ROGUE', specId: 'subtlety' };
const foreverWarrior: CharacterInput = { game: 'forever', name: 'Thorvik', realm: 'Argent Dawn', classId: 'WARRIOR', specId: 'protection' };

function added(store: CharacterStore, userId: string, input: CharacterInput, id: string) {
	const result = addCharacter(store, userId, input, id);
	assert.ok(!('error' in result), 'error' in result ? result.error : '');
	return result;
}

describe('games', () => {
	it('should list 13 retail classes and 9 Forever classes, each with a role per spec', () => {
		assert.equal(games.retail.classes.length, 13);
		assert.equal(games.forever.classes.length, 9);
		for (const game of Object.values(games)) {
			for (const wowClass of game.classes) {
				for (const spec of wowClass.specs) {
					assert.ok(spec.roles.length > 0, `${game.id} ${spec.name} ${wowClass.name}`);
				}
			}
		}
	});

	it("should use Raid-Helper's spec names, numbered for the second spec of a name", () => {
		const names = games.retail.classes.flatMap(c => c.specs.map(s => s.raidHelperName));
		assert.equal(new Set(names).size, names.length);
		assert.ok(names.includes('Frost1'));
		assert.ok(names.includes('Holy1'));
		assert.ok(names.includes('Protection1'));
		assert.ok(names.includes('Restoration1'));
		assert.ok(names.includes('Beastmastery'));
	});

	// Spec IDs are saved with each character, so renaming one would orphan saved characters
	it('should keep the saved spec IDs', () => {
		const ids = Object.values(games).map(g => g.classes.map(c => `${c.id}: ${c.specs.map(s => s.id).join(' ')}`));
		assert.deepEqual(ids, [
			[
				'DEATHKNIGHT: blood frost unholy',
				'DEMONHUNTER: havoc vengeance devourer',
				'DRUID: balance feral guardian restoration',
				'EVOKER: devastation preservation augmentation',
				'HUNTER: beast-mastery marksmanship survival',
				'MAGE: arcane fire frost',
				'MONK: brewmaster mistweaver windwalker',
				'PALADIN: holy protection retribution',
				'PRIEST: discipline holy shadow',
				'ROGUE: assassination outlaw subtlety',
				'SHAMAN: elemental enhancement restoration',
				'WARLOCK: affliction demonology destruction',
				'WARRIOR: arms fury protection',
			],
			[
				'DRUID: balance feral restoration',
				'HUNTER: beast-mastery marksmanship survival',
				'MAGE: arcane fire frost',
				'PALADIN: holy protection retribution',
				'PRIEST: discipline holy shadow',
				'ROGUE: assassination combat subtlety',
				'SHAMAN: elemental enhancement restoration',
				'WARLOCK: affliction demonology destruction',
				'WARRIOR: arms fury protection',
			],
		]);
	});
});

describe('normalizeName', () => {
	it('should capitalise like the game does', () => {
		assert.equal(normalizeName(' tHORVIK '), 'Thorvik');
		assert.equal(normalizeName('élune'), 'Élune');
	});

	it('should refuse names that the game would refuse', () => {
		for (const bad of ['T', 'Thorvikthorvik', 'Thor vik', 'Thor1']) {
			assert.deepEqual(normalizeName(bad), { error: 'Character names are 2 to 12 letters, with no spaces.' });
		}
	});
});

describe('findRealm', () => {
	it('should find the EU realm however it was typed, and give its official name', () => {
		assert.equal(findRealm('  argent dawn '), 'Argent Dawn');
		assert.equal(findRealm('ArgentDawn'), 'Argent Dawn');
		assert.equal(findRealm('kelthuzad'), "Kel'Thuzad");
		assert.equal(findRealm('der rat von dalaran'), 'Der Rat von Dalaran');
		assert.equal(findRealm('azjol nerub'), 'Azjol-Nerub');
		assert.equal(findRealm('Aggra (Português)'), 'Aggra (Português)');
		assert.equal(findRealm('festung der sturme'), 'Festung der Stürme');
	});

	it('should take the English name of a Russian realm', () => {
		assert.equal(findRealm('Gordunni'), 'Гордунни');
	});

	it('should refuse a realm that EU does not have', () => {
		assert.deepEqual(findRealm('Moon Guard'), { error: "There's no EU realm called Moon Guard." });
		assert.deepEqual(findRealm('  '), { error: 'Type your realm.' });
	});
});

describe('characterName', () => {
	it('should leave the guild realm off and write other realms the way the game does', () => {
		assert.equal(characterName({ name: 'Thorvik', realm: 'Argent Dawn' }, 'argent dawn'), 'Thorvik');
		assert.equal(characterName({ name: 'Thorvik', realm: 'Twisting Nether' }, 'Argent Dawn'), 'Thorvik-TwistingNether');
		assert.equal(characterName({ name: 'Thorvik', realm: 'Azjol-Nerub' }, 'Argent Dawn'), 'Thorvik-AzjolNerub');
		assert.equal(characterName({ name: 'Thorvik', realm: 'Der Rat von Dalaran' }, ''), 'Thorvik-DerRatvonDalaran');
		assert.equal(characterName({ name: 'Thorvik', realm: "Kel'Thuzad" }, ''), "Thorvik-Kel'Thuzad");
		assert.equal(characterName({ name: 'Thorvik', realm: '' }, ''), 'Thorvik');
	});
});

describe('describeCharacter', () => {
	it('should read spec and class, with the off-spec in brackets', () => {
		assert.equal(describeCharacter(blood), 'Blood Death Knight (off-spec Frost)');
		assert.equal(describeCharacter(rogue), 'Subtlety Rogue');
	});
});

describe('addCharacter', () => {
	it('should tidy the input and make the first character per game the main', () => {
		const store: CharacterStore = {};
		const first = added(store, 'u1', blood, 'a');
		assert.equal(first.name, 'Thorvik');
		assert.equal(first.realm, 'Argent Dawn');
		assert.equal(first.main, true);
		assert.equal(added(store, 'u1', rogue, 'b').main, false);
		assert.equal(added(store, 'u1', foreverWarrior, 'c').main, true);
	});

	it('should refuse the same character twice, for the same member or another', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		assert.deepEqual(addCharacter(store, 'u1', { ...blood, name: 'THORVIK', realm: 'ArgentDawn' }, 'b'), { error: 'Thorvik (Argent Dawn) is already saved.' });
		assert.deepEqual(addCharacter(store, 'u2', blood, 'c'), { error: 'Thorvik (Argent Dawn) is saved by <@u1>. Ask them or an officer to remove it.' });
	});

	it('should allow the same name in the other game', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		added(store, 'u1', foreverWarrior, 'b');
		assert.equal(charactersOf(store, 'u1').length, 2);
	});

	it('should refuse an off-spec that is the same as the spec', () => {
		assert.deepEqual(addCharacter({}, 'u1', { ...blood, offSpecId: 'blood' }, 'a'), { error: 'Pick an off-spec other than your spec, or None.' });
	});

	it('should save the official realm name', () => {
		const store: CharacterStore = {};
		assert.equal(added(store, 'u1', { ...blood, realm: 'der rat von dalaran' }, 'a').realm, 'Der Rat von Dalaran');
	});

	it('should refuse a retail realm that does not exist, but take the guild realm for Forever as given', () => {
		assert.deepEqual(addCharacter({}, 'u1', { ...blood, realm: 'Nowhere' }, 'a'), { error: "There's no EU realm called Nowhere." });
		assert.equal(added({}, 'u1', { ...foreverWarrior, realm: 'Anything' }, 'a').realm, '');
	});

	it('should refuse a spec from another class', () => {
		assert.deepEqual(addCharacter({}, 'u1', { ...blood, specId: 'subtlety' }, 'a'), { error: 'Pick a spec.' });
	});

	it('should stop at 10 characters per game', () => {
		const store: CharacterStore = {};
		const names = ['Aa', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff', 'Gg', 'Hh', 'Ii', 'Jj'];
		names.forEach((name, i) => added(store, 'u1', { ...rogue, name }, String(i)));
		assert.deepEqual(addCharacter(store, 'u1', { ...rogue, name: 'Kk' }, 'k'), { error: 'You can save up to 10 characters per game.' });
		added(store, 'u1', foreverWarrior, 'f');
	});
});

describe('charactersOf', () => {
	it('should list retail first, then the main, then by name', () => {
		const store: CharacterStore = {};
		added(store, 'u1', foreverWarrior, 'f');
		added(store, 'u1', { ...rogue, name: 'Zed' }, 'z');
		added(store, 'u1', rogue, 'k');
		assert.deepEqual(charactersOf(store, 'u1').map(c => c.name), ['Zed', 'Kapi', 'Thorvik']);
		assert.deepEqual(charactersOf(store, 'u2'), []);
	});
});

describe('updateCharacter', () => {
	it('should change name, realm and specs, but not class or game', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		const result = updateCharacter(store, 'u1', 'a', { name: 'thorgrim', realm: 'silvermoon', specId: 'unholy' });
		assert.ok(!('error' in result));
		assert.equal(result.name, 'Thorgrim');
		assert.equal(result.realm, 'Silvermoon');
		assert.equal(result.specId, 'unholy');
		assert.equal(result.offSpecId, undefined);
		assert.equal(result.classId, 'DEATHKNIGHT');
	});

	it('should allow saving a character unchanged', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		assert.ok(!('error' in updateCharacter(store, 'u1', 'a', blood)));
	});

	it("should refuse another member's character", () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		assert.deepEqual(updateCharacter(store, 'u2', 'a', blood), { error: 'That character is no longer saved.' });
	});
});

describe('setMain and removeCharacter', () => {
	it('should keep one main per game', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		added(store, 'u1', rogue, 'b');
		added(store, 'u1', foreverWarrior, 'c');
		setMain(store, 'u1', 'b');
		assert.deepEqual(store.u1.map(c => c.main), [false, true, true]);
	});

	it('should hand the main to the next character when the main is removed', () => {
		const store: CharacterStore = {};
		added(store, 'u1', blood, 'a');
		added(store, 'u1', rogue, 'b');
		const first = removeCharacter(store, 'u1', 'a');
		assert.ok(!('error' in first));
		assert.equal(first.newMain?.name, 'Kapi');
		assert.equal(store.u1[0].main, true);
		const second = removeCharacter(store, 'u1', 'b');
		assert.ok(!('error' in second));
		assert.equal(second.newMain, undefined);
		assert.equal(store.u1, undefined);
	});
});
