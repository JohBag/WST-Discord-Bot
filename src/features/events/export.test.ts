import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCharacter } from './characters.js';
import type { CharacterStore } from './characters.js';
import { euRealms } from './eu-realms.js';
import { exportEntries, exportJson, exportNames, exportText } from './export.js';
import { createEvent, respond, signupChoices, withdraw } from './store.js';
import type { RaidEvent } from './store.js';
import { buildExportModal } from './event-actions.js';

function raid(game: 'retail' | 'forever' = 'retail'): RaidEvent {
	return createEvent({ game, kind: 'raid', title: 'Mythic night', description: '', start: 2_000, leaderId: 'l', leaderName: 'Leesha', channelId: 'c' }, 0, 'e1');
}

function signUp(event: RaidEvent, userId: string, name: string, classId: string, specId: string, status: 'signed' | 'late' | 'tentative' = 'signed', realm = 'Aggramar', role?: string) {
	const store: CharacterStore = {};
	const added = addCharacter(store, userId, { game: event.game, name, realm: event.game === 'retail' ? realm : '', classId, specId }, `${userId}-c`);
	assert.ok(!('error' in added), 'error' in added ? added.error : '');
	const choices = signupChoices(store[userId]);
	respond(event, userId, name, status, role ? choices.find(c => c.role === role) : choices[0]);
}

describe('exportEntries', () => {
	it('should list the roster in answering order, always with the realm, and the role and spec names the addon reads', () => {
		const event = raid();
		signUp(event, 'u1', 'Thorvik', 'DEATHKNIGHT', 'frost');
		signUp(event, 'u2', 'Seru', 'SHAMAN', 'restoration', 'late');
		signUp(event, 'u3', 'Hunta', 'HUNTER', 'beast-mastery', 'signed', 'Der Rat von Dalaran');
		signUp(event, 'u4', 'Kapi', 'ROGUE', 'outlaw', 'tentative');
		respond(event, 'u5', 'Stylz', 'absence');
		signUp(event, 'u6', 'Paly', 'PALADIN', 'protection');
		assert.deepEqual(exportEntries(event), [
			{ name: 'Thorvik-Aggramar', className: 'Melee', specName: 'Frost1' },
			{ name: 'Seru-Aggramar', className: 'Healer', specName: 'Restoration1' },
			{ name: 'Hunta-DerRatvonDalaran', className: 'Ranged', specName: 'Beastmastery' },
			{ name: 'Paly-Aggramar', className: 'Tank', specName: 'Protection1' },
		]);
	});

	it('should leave out someone who withdrew', () => {
		const event = raid();
		signUp(event, 'u1', 'Thorvik', 'DEATHKNIGHT', 'blood');
		signUp(event, 'u2', 'Seru', 'SHAMAN', 'elemental');
		withdraw(event, 'u1');
		assert.deepEqual(exportEntries(event).map(e => e.name), ['Seru-Aggramar']);
	});

	it("should give a Forever Feral signed up as DPS the addon's Melee, and as tank Tank", () => {
		const event = raid('forever');
		signUp(event, 'u1', 'Kitty Moonpaw', 'DRUID', 'feral', 'signed', '', 'DPS');
		signUp(event, 'u2', 'Bear Oakhide', 'DRUID', 'feral', 'signed', '', 'Tank');
		assert.deepEqual(exportEntries(event).map(e => [e.name, e.className]), [['Kitty Moonpaw', 'Melee'], ['Bear Oakhide', 'Tank']]);
	});

	// The addon splits the name on its first hyphen, removes spaces and hyphens from the realm and
	// looks that up in LibRealmInfo. Every EU realm has to come through that as itself
	it('should write every EU realm the way the addon looks it up', () => {
		const event = raid();
		euRealms.forEach(([realm], i) => signUp(event, `u${i}`, 'Abc' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26) % 26), 'MAGE', 'frost', 'signed', realm));
		const entries = exportEntries(event);
		assert.equal(entries.length, euRealms.length);
		entries.forEach((entry, i) => {
			const [, realm, extra] = entry.name.split('-');
			assert.equal(extra, undefined, entry.name);
			assert.equal(realm, euRealms[i][0].replace(/[\s-]/g, ''), entry.name);
		});
	});
});

describe('exportJson', () => {
	it('should fit a full 40-player raid with long off-realm names in the copy box', () => {
		const event = raid();
		for (let i = 0; i < 40; i++) {
			signUp(event, `u${i}`, 'Abcdefghij' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + Math.floor(i / 26)), 'HUNTER', 'beast-mastery', 'signed', 'Der Rat von Dalaran');
		}
		const json = exportJson(event);
		assert.ok(json.length <= 4000, `${json.length}`);
		assert.equal(JSON.parse(json).signUps.length, 40);
	});
});

describe('buildExportModal', () => {
	it('should hold the JSON in a box, with how many it invites', () => {
		const event = raid();
		signUp(event, 'u1', 'Thorvik', 'DEATHKNIGHT', 'blood');
		const modal = buildExportModal(event, exportJson(event)).toJSON() as any;
		assert.equal(modal.title, 'Export for Raid-Helper Helper');
		assert.equal(modal.custom_id, 'event:e1:export-done');
		assert.equal(modal.components[0].label, '1 to invite');
		assert.equal(modal.components[0].description, 'Ctrl+A, Ctrl+C, then paste into /rhh in game');
		assert.equal(modal.components[0].component.value, '{"signUps":[{"name":"Thorvik-Aggramar","className":"Tank","specName":"Blood"}]}');
	});
});

describe('Forever export', () => {
	it('should give the names to invite, one per line, since the retail addon does not load there', () => {
		const event = raid('forever');
		signUp(event, 'u1', 'Kitty Moonpaw', 'DRUID', 'feral');
		signUp(event, 'u2', 'Stabby Shadowstep', 'ROGUE', 'combat', 'late');
		signUp(event, 'u3', 'Maybe Later', 'MAGE', 'frost', 'tentative');
		assert.equal(exportNames(event), 'Kitty Moonpaw\nStabby Shadowstep');
		assert.equal(exportText(event), 'Kitty Moonpaw\nStabby Shadowstep');
		const modal = buildExportModal(event, exportText(event)).toJSON() as any;
		assert.equal(modal.title, 'Names to invite');
		assert.equal(modal.components[0].label, '2 to invite');
		assert.equal(modal.components[0].description, 'Ctrl+A, Ctrl+C, then invite them in game');
	});
});
