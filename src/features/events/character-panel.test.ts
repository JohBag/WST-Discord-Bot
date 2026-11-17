import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterModal, buildCharacterPanel } from './character-panel.js';
import { addCharacter } from './characters.js';
import type { CharacterStore } from './characters.js';
import type { View } from './character-panel.js';

function storeWithCharacters(): CharacterStore {
	const store: CharacterStore = {};
	addCharacter(store, 'u1', { game: 'retail', name: 'Thorvik', realm: 'Argent Dawn', classId: 'DEATHKNIGHT', specId: 'blood', offSpecId: 'frost' }, 'a');
	addCharacter(store, 'u1', { game: 'retail', name: 'Kapi', realm: 'Twisting Nether', classId: 'ROGUE', specId: 'subtlety' }, 'b');
	addCharacter(store, 'u1', { game: 'forever', name: 'Thorvik Stonefist', realm: '', classId: 'WARRIOR', specId: 'protection' }, 'c');
	return store;
}

function render(store: CharacterStore, view: View, ownerName?: string) {
	const panel = buildCharacterPanel(store, 'u1', view, ownerName);
	return {
		content: panel.content,
		allowedMentions: panel.allowedMentions,
		embed: panel.embeds[0]?.toJSON(),
		rows: panel.components.map(row => row.toJSON().components) as any[][],
	};
}

describe('buildCharacterPanel', () => {
	it('should show both games with the main starred, and an add button per game', () => {
		const { embed, rows } = render(storeWithCharacters(), { kind: 'home' });
		assert.equal(embed!.title, 'Your characters');
		const lines = embed!.description!.split('\n');
		assert.equal(lines[0], '**Retail**');
		assert.equal(lines[1], '⭐ Thorvik-ArgentDawn: Blood Death Knight (off-spec Frost)');
		assert.equal(lines[2], 'Kapi-TwistingNether: Subtlety Rogue');
		assert.deepEqual(lines.slice(4), ['**Forever**', '⭐ Thorvik Stonefist: Protection Warrior']);
		assert.equal(embed!.footer!.text, '⭐ Main, used for raid sign-ups');
		assert.deepEqual(rows[0].map(b => b.label), ['Add Retail character', 'Add Forever character']);
		assert.equal(rows[0][0].custom_id, 'characters:u1:add:retail');
		assert.equal(rows[1][0].placeholder, 'Pick a character');
		assert.deepEqual(rows[1][0].options.map((o: any) => o.value), ['a', 'b', 'c']);
	});

	it("should name the member when an officer opens someone else's characters", () => {
		assert.equal(render(storeWithCharacters(), { kind: 'home' }, 'Kapi').embed!.title, "Kapi's characters");
	});

	it('should leave out the pick menu when nothing is saved', () => {
		const { embed, rows } = render({}, { kind: 'home' });
		assert.equal(rows.length, 1);
		assert.equal(embed!.description, '**Retail**\nNo characters yet.\n\n**Forever**\nNo characters yet.');
	});

	it('should show the notice above the panel without pinging anyone it names', () => {
		const { content, allowedMentions } = render({}, { kind: 'home', notice: 'Removed Thorvik.' });
		assert.equal(content, 'Removed Thorvik.');
		assert.deepEqual(allowedMentions, { parse: [] });
	});

	it('should offer every class as a button, five to a row, then Back', () => {
		const retail = render({}, { kind: 'pick-class', game: 'retail' });
		assert.deepEqual(retail.rows.map(r => r.length), [5, 5, 3, 1]);
		assert.equal(retail.rows[0][0].label, 'Death Knight');
		assert.equal(retail.rows[0][0].custom_id, 'characters:u1:class:retail:DEATHKNIGHT');
		assert.equal(retail.rows[3][0].label, 'Back');
		const forever = render({}, { kind: 'pick-class', game: 'forever' });
		assert.deepEqual(forever.rows.map(r => r.length), [5, 4, 1]);
	});

	it('should show a character with its specs and disable Make main for the main', () => {
		const { embed, rows } = render(storeWithCharacters(), { kind: 'character', id: 'a' });
		assert.equal(embed!.title, '⭐ Thorvik');
		assert.equal(embed!.description, 'Game: Retail\nRealm: Argent Dawn\nClass: Death Knight\nSpec: Blood\nOff-spec: Frost');
		assert.deepEqual(rows[0].map(b => b.label), ['Edit', 'Make main', 'Remove', 'Back']);
		assert.equal(rows[0][1].disabled, true);
	});

	it('should leave the realm out for a Forever character on the guild realm', () => {
		const { embed } = render(storeWithCharacters(), { kind: 'character', id: 'c' });
		assert.equal(embed!.description, 'Game: Forever\nClass: Warrior\nSpec: Protection\nOff-spec: None');
	});

	it('should go home when the character is gone', () => {
		assert.equal(render(storeWithCharacters(), { kind: 'character', id: 'gone' }).content, 'That character is no longer saved.');
	});

	it('should ask before removing', () => {
		const { content, rows } = render(storeWithCharacters(), { kind: 'confirm-remove', id: 'b' });
		assert.equal(content, 'Remove Kapi-TwistingNether?');
		assert.deepEqual(rows[0].map(b => b.label), ['Remove', 'Cancel']);
	});

	it('should offer to open a turned-down form again, and go back where it came from', () => {
		const { content, rows } = render({}, { kind: 'rejected', notice: "There's no EU realm called Nowhere.", back: { kind: 'character', id: 'a' } });
		assert.equal(content, "There's no EU realm called Nowhere.");
		assert.deepEqual(rows[0].map(b => [b.label, b.custom_id]), [['Try again', 'characters:u1:retry'], ['Back', 'characters:u1:character:a']]);
	});
});

describe('buildCharacterModal', () => {
	it('should ask for name, realm, spec and off-spec for retail, with only the class specs and None first', () => {
		const modal = buildCharacterModal('u1', 'retail', 'PALADIN').toJSON() as any;
		assert.equal(modal.title, 'New Retail Paladin');
		assert.equal(modal.custom_id, 'characters:u1:new:retail:PALADIN');
		assert.deepEqual(modal.components.map((c: any) => c.label), ['Character name', 'Realm', 'Spec', 'Off-spec']);
		assert.deepEqual(modal.components[2].component.options.map((o: any) => o.label), ['Holy', 'Protection', 'Retribution']);
		assert.deepEqual(modal.components[3].component.options.map((o: any) => o.label), ['None', 'Holy', 'Protection', 'Retribution']);
		assert.deepEqual(modal.components[3].component.options.filter((o: any) => o.default).map((o: any) => o.label), ['None']);
	});

	it("should fill in the guild's realm for a new retail character", () => {
		const modal = buildCharacterModal('u1', 'retail', 'MAGE').toJSON() as any;
		assert.equal(modal.components[1].component.value, 'Aggramar');
	});

	it('should leave the realm out for Forever', () => {
		const modal = buildCharacterModal('u1', 'forever', 'DRUID').toJSON() as any;
		assert.equal(modal.title, 'New Forever Druid');
		assert.deepEqual(modal.components.map((c: any) => c.label), ['First and last name', 'Spec', 'Off-spec']);
		assert.equal(modal.components[0].component.max_length, 25);
	});

	it('should take a 12-letter name for retail', () => {
		const modal = buildCharacterModal('u1', 'retail', 'DRUID').toJSON() as any;
		assert.equal(modal.components[0].component.max_length, 12);
	});

	it('should fill in a saved character when editing', () => {
		const store = storeWithCharacters();
		const modal = buildCharacterModal('u1', 'retail', 'DEATHKNIGHT', { existing: store.u1[0] }).toJSON() as any;
		assert.equal(modal.title, 'Edit Thorvik');
		assert.equal(modal.custom_id, 'characters:u1:save:a');
		assert.equal(modal.components[0].component.value, 'Thorvik');
		assert.equal(modal.components[1].component.value, 'Argent Dawn');
		assert.deepEqual(modal.components[2].component.options.filter((o: any) => o.default).map((o: any) => o.label), ['Blood']);
		assert.deepEqual(modal.components[3].component.options.filter((o: any) => o.default).map((o: any) => o.label), ['Frost']);
	});

	it('should fill in what was typed when a turned-down form opens again', () => {
		const modal = buildCharacterModal('u1', 'retail', 'ROGUE', { values: { name: 'Kapi', realm: 'Nowhere', specId: 'outlaw' } }).toJSON() as any;
		assert.equal(modal.custom_id, 'characters:u1:new:retail:ROGUE');
		assert.equal(modal.components[0].component.value, 'Kapi');
		assert.equal(modal.components[1].component.value, 'Nowhere');
		assert.deepEqual(modal.components[2].component.options.filter((o: any) => o.default).map((o: any) => o.label), ['Outlaw']);
	});
});
