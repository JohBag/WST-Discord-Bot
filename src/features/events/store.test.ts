import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCharacter } from './characters.js';
import type { Character, CharacterStore } from './characters.js';
import { choiceValue, createEvent, findChoice, lastRole, respond, signupChoices, withdraw } from './store.js';
import { closeStarted } from './event-actions.js';

function characters(): Character[] {
	const store: CharacterStore = {};
	addCharacter(store, 'u1', { game: 'forever', name: 'Kapi', realm: '', classId: 'ROGUE', specId: 'combat' }, 'alt');
	addCharacter(store, 'u1', { game: 'forever', name: 'Thorvik', realm: '', classId: 'DRUID', specId: 'feral', offSpecId: 'restoration' }, 'main');
	store.u1.find(c => c.id === 'main')!.main = true;
	store.u1.find(c => c.id === 'alt')!.main = false;
	return store.u1;
}

function newEvent(id = 'e1') {
	return createEvent({ game: 'forever', kind: 'raid', title: 'Onyxia', description: '', start: 2_000, leaderId: 'lead', leaderName: 'Lead', channelId: 'c', targets: { Tank: 2 } }, 1_000, id);
}

describe('signupChoices', () => {
	it("should offer every character's spec and off-spec first, the main first, then their other specs, once per role", () => {
		const labels = signupChoices(characters()).map(c => `${c.character.name} ${c.specId} ${c.role}`);
		assert.deepEqual(labels, [
			'Thorvik feral Melee',
			'Thorvik feral Tank',
			'Thorvik restoration Healer',
			'Kapi combat Melee',
			'Thorvik balance Ranged',
			'Kapi assassination Melee',
			'Kapi subtlety Melee',
		]);
	});

	it('should reach the tenth alt within the 25 options', () => {
		const store: CharacterStore = {};
		'Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj'.split(' ').forEach((name, i) => addCharacter(store, 'u1', { game: 'retail', name, realm: 'Aggramar', classId: 'DRUID', specId: 'feral', offSpecId: 'guardian' }, String(i)));
		const choices = signupChoices(store.u1);
		assert.equal(choices.length, 25);
		assert.ok(choices.some(c => c.character.name === 'Jj' && c.specId === 'guardian'));
	});

	it('should find a choice by its menu value', () => {
		const chars = characters();
		const choice = signupChoices(chars)[1];
		assert.equal(choiceValue(choice), 'main|feral|Tank');
		assert.deepEqual(findChoice(chars, 'main|feral|Tank'), choice);
		assert.equal(findChoice(chars, 'gone|feral|Tank'), undefined);
	});
});

describe('respond and withdraw', () => {
	it('should number sign-ups in order and keep the number and character through changes', () => {
		const event = newEvent();
		const chars = characters();
		respond(event, 'u1', 'Thor', 'signed', signupChoices(chars)[0], 1);
		respond(event, 'u2', 'Seru', 'absence', undefined, 2);
		respond(event, 'u1', 'Thor', 'late', undefined, 3);
		assert.deepEqual(event.signups.map(s => [s.userId, s.displayName, s.status, s.number]), [['u1', 'Thor', 'late', 1], ['u2', 'Seru', 'absence', 2]]);
		assert.equal(event.signups[0].character?.name, 'Thorvik');
	});

	it('should copy the character, with the off-spec only when it adds a role', () => {
		const event = newEvent();
		const chars = characters();
		const asFeral = respond(event, 'u1', 'Thor', 'signed', signupChoices(chars)[1]);
		assert.deepEqual(asFeral.character, { id: 'main', name: 'Thorvik', realm: '', classId: 'DRUID', specId: 'feral', role: 'Tank', offSpecId: 'restoration' });
		const asResto = respond(event, 'u1', 'Thor', 'signed', signupChoices(chars)[2]);
		assert.equal(asResto.character?.offSpecId, undefined);
	});

	it('should leave out an off-spec in the same role', () => {
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'retail', name: 'Aidan', realm: 'Aggramar', classId: 'WARRIOR', specId: 'arms', offSpecId: 'fury' }, 'w');
		assert.equal(respond(newEvent(), 'u1', 'Aidan', 'signed', signupChoices(store.u1)[0]).character?.offSpecId, undefined);
	});

	it('should give a new number after withdrawing and coming back', () => {
		const event = newEvent();
		respond(event, 'u1', 'Thor', 'tentative');
		assert.equal(withdraw(event, 'u1'), true);
		assert.equal(withdraw(event, 'u1'), false);
		assert.equal(respond(event, 'u1', 'Thor', 'tentative').number, 2);
	});
});

describe('lastRole', () => {
	it('should find the role a character last signed up as with a spec, across events', () => {
		const chars = characters();
		const first = newEvent('e1');
		const second = newEvent('e2');
		respond(first, 'u1', 'Thor', 'signed', signupChoices(chars)[0], 1);
		respond(second, 'u1', 'Thor', 'signed', signupChoices(chars)[1], 2);
		assert.equal(lastRole({ e1: first, e2: second }, 'u1', 'main', 'feral'), 'Tank');
		assert.equal(lastRole({ e1: first, e2: second }, 'u1', 'main', 'balance'), undefined);
		assert.equal(lastRole({ e1: first, e2: second }, 'u2', 'main', 'feral'), undefined);
	});
});

describe('closeStarted', () => {
	it('should close sign-ups once at the start, and leave a reopened event open', () => {
		const event = newEvent();
		const store = { e1: event };
		assert.deepEqual(closeStarted(store, 1_500), []);
		assert.deepEqual(closeStarted(store, 2_000).map(e => e.id), ['e1']);
		assert.equal(event.closed, true);
		assert.equal(event.closedBy, 'start');
		event.closed = false;
		assert.deepEqual(closeStarted(store, 3_000), []);
		assert.equal(event.closed, false);
	});

	it('should leave cancelled events and ones an officer closed alone', () => {
		const cancelled = newEvent();
		cancelled.cancelled = true;
		assert.deepEqual(closeStarted({ e1: cancelled }, 3_000), []);
		const closedByOfficer = newEvent();
		closedByOfficer.closed = true;
		closedByOfficer.closedBy = 'officer';
		closeStarted({ e1: closedByOfficer }, 3_000);
		assert.equal(closedByOfficer.closedBy, 'officer');
	});
});
