import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCharacter } from './characters.js';
import type { CharacterStore } from './characters.js';
import { interestChoice } from './interest.js';
import { createEvent, respond, signupChoices } from './store.js';

function forever() {
	return createEvent({ game: 'forever', kind: 'raid', title: 'Onyxia', description: '', start: 2_000, leaderId: 'l', leaderName: 'Leesha', channelId: 'c' }, 0, 'e1');
}

describe('interestChoice', () => {
	it("should sign up as the main's spec, in its usual role", () => {
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'retail', name: 'Thorvik', realm: 'Aggramar', classId: 'DEATHKNIGHT', specId: 'blood' }, 'main');
		addCharacter(store, 'u1', { game: 'retail', name: 'Kapi', realm: 'Aggramar', classId: 'ROGUE', specId: 'outlaw' }, 'alt');
		const choice = interestChoice({}, 'u1', store.u1)!;
		assert.deepEqual([choice.character.name, choice.specId, choice.role], ['Thorvik', 'blood', 'Tank']);
	});

	it('should take the role a two-role spec last signed up as, without asking', () => {
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'forever', name: 'Thorvik Stonefist', realm: '', classId: 'DRUID', specId: 'feral' }, 'main');
		assert.equal(interestChoice({}, 'u1', store.u1)!.role, 'DPS');
		const earlier = forever();
		respond(earlier, 'u1', 'Thor', 'signed', signupChoices(store.u1).find(c => c.role === 'Tank'));
		assert.equal(interestChoice({ e1: earlier }, 'u1', store.u1)!.role, 'Tank');
	});

	it("should still sign up with one of their specs when the main's saved spec is unknown", () => {
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'retail', name: 'Thorvik', realm: 'Aggramar', classId: 'DEATHKNIGHT', specId: 'blood' }, 'main');
		store.u1[0].specId = 'renamed';
		assert.equal(interestChoice({}, 'u1', store.u1)?.character.name, 'Thorvik');
	});

	it('should give nothing without a character', () => {
		assert.equal(interestChoice({}, 'u1', []), undefined);
	});
});

describe('viaInterest', () => {
	it('should be cleared by any answer on the post', () => {
		const event = forever();
		const signup = respond(event, 'u1', 'Thor', 'signed');
		signup.viaInterest = 'entry';
		respond(event, 'u1', 'Thor', 'late');
		assert.equal(signup.viaInterest, undefined);
	});
});
