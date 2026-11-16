import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCharacter } from './characters.js';
import type { CharacterStore } from './characters.js';
import { buildPostButtons, buildPostEmbed } from './post.js';
import type { PostContext } from './post.js';
import { createEvent, respond, signupChoices, withdraw } from './store.js';
import type { RaidEvent } from './store.js';
import { buildEventModal, roleQuestion, signupReply } from './event-actions.js';

const context: PostContext = { classEmoji: classId => `:${classId.toLowerCase()}:`, homeRealm: 'Aggramar' };
const start = Date.UTC(2026, 10, 18, 18, 30);
const stamp = start / 1000;

function raid(game: 'retail' | 'forever' = 'retail', description = 'Bring flasks.'): RaidEvent {
	return createEvent({ game, kind: 'raid', title: 'Mythic night', description, start, leaderId: 'lead', leaderName: 'Leesha', channelId: 'c' }, 0, 'e1');
}

function signUp(event: RaidEvent, userId: string, name: string, classId: string, specId: string, status: 'signed' | 'late' | 'tentative' = 'signed', offSpecId?: string, realm = 'Aggramar') {
	const store: CharacterStore = {};
	addCharacter(store, userId, { game: event.game, name, realm: event.game === 'retail' ? realm : '', classId, specId, offSpecId }, `${userId}-c`);
	respond(event, userId, `${name}Discord`, status, signupChoices(store[userId])[0]);
}

function filledRaid(): RaidEvent {
	const event = raid();
	signUp(event, 'u1', 'Thorvik', 'DEATHKNIGHT', 'blood');
	signUp(event, 'u2', 'Kapi', 'ROGUE', 'subtlety', 'late');
	signUp(event, 'u3', 'Seru', 'SHAMAN', 'restoration', 'signed', 'elemental', 'Twisting Nether');
	signUp(event, 'u4', 'Nel', 'MAGE', 'frost', 'tentative');
	respond(event, 'u5', 'Stylz', 'absence');
	signUp(event, 'u6', 'Aidan', 'WARRIOR', 'fury', 'signed', 'protection');
	return event;
}

function fieldsOf(event: RaidEvent, ctx = context) {
	return buildPostEmbed(event, ctx).toJSON().fields!.map(f => [f.name, f.value]);
}

describe('buildPostEmbed', () => {
	it('should give the details on top, then a section per role with its count, then the rest', () => {
		const embed = buildPostEmbed(filledRaid(), context).toJSON();
		assert.equal(embed.title, 'Mythic night');
		assert.equal(embed.footer!.text, 'WoW Retail raid');
		assert.equal(embed.description, `Bring flasks.\n\n📅 <t:${stamp}:F> (<t:${stamp}:R>)\n👑 Leesha\n✅ 4 signed up`);
		assert.deepEqual(fieldsOf(filledRaid()), [
			['🛡️ Tanks 1', ':deathknight: `1` **Thorvik** Blood ThorvikDiscord'],
			['💚 Healers 1', ':shaman: `3` **Seru-TwistingNether** Restoration (⚔️) SeruDiscord'],
			['⚔️ DPS 2', ':rogue: `2` **Kapi** Subtlety (late) KapiDiscord\n:warrior: `6` **Aidan** Fury (🛡️) AidanDiscord'],
			['❔ Tentative 1', '`4` :mage: Nel'],
			['🚫 Absent 1', '`5` Stylz'],
		]);
	});

	it('should mark closed and cancelled events', () => {
		const event = raid();
		event.closed = true;
		assert.match(buildPostEmbed(event, context).toJSON().description!, /^Bring flasks\.\n\n🔒 Sign-ups closed\n/);
		event.cancelled = true;
		assert.match(buildPostEmbed(event, context).toJSON().description!, /^Bring flasks\.\n\n\*\*Cancelled\*\*\n/);
	});

	it('should show an event as one attending list, without a second count on top', () => {
		const event = createEvent({ game: 'forever', kind: 'event', title: 'Guild meeting', description: '', start, leaderId: 'lead', leaderName: 'Leesha', channelId: 'c' }, 0, 'e2');
		respond(event, 'u1', 'Seru', 'signed');
		respond(event, 'u2', 'Kapi', 'tentative');
		assert.equal(buildPostEmbed(event, context).toJSON().description, `📅 <t:${stamp}:F> (<t:${stamp}:R>)\n👑 Leesha`);
		assert.deepEqual(fieldsOf(event), [['✅ Attending 1', '`1` Seru'], ['❔ Tentative 1', '`2` Kapi']]);
	});

	// 40 in the roster plus 15 more answers, long names, real-length icons and the longest description
	function fullForeverRaid(description: string) {
		const event = raid('forever', description);
		const classes = [['WARRIOR', 'fury'], ['MAGE', 'frost'], ['PRIEST', 'holy'], ['WARLOCK', 'affliction'], ['ROGUE', 'combat']];
		for (let i = 0; i < 55; i++) {
			const [classId, specId] = classes[i % classes.length];
			const status = i < 40 ? 'signed' : 'tentative';
			const name = `Abcdefghij${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`;
			if (i >= 48) {
				respond(event, `1234567890123456${String(i).padStart(3, '0')}`, 'Discordname1234', 'absence');
			} else {
				signUp(event, `1234567890123456${String(i).padStart(3, '0')}`, name, classId, specId, status);
			}
		}
		return event;
	}
	const realIcons: PostContext = { classEmoji: () => '<:war:1439123456789012345>', homeRealm: 'Aggramar' };

	it('should fit a full 40-player Forever raid with every name, member and answer', () => {
		const embed = buildPostEmbed(fullForeverRaid('Bring consumables.'), realIcons).toJSON();
		const text = JSON.stringify(embed);
		const lines = embed.fields!.flatMap(f => f.value.split('\n'));
		assert.equal(lines.filter(line => line.includes('Abcdefghij') && line.includes('Discord')).length, 40);
		assert.ok(text.includes('Discordname1234'));
		assert.ok(embed.fields!.every(f => f.value.length <= 1024));
		assert.ok(!text.includes('more'));
	});

	it('should stay within Discord limits with the longest description, cutting at whole lines', () => {
		const embed = buildPostEmbed(fullForeverRaid('x'.repeat(1000)), realIcons).toJSON();
		const total = embed.title!.length + embed.description!.length + embed.footer!.text.length
			+ embed.fields!.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
		assert.ok(total <= 6000, `${total}`);
		assert.ok(embed.fields!.length <= 25);
		for (const line of embed.fields!.flatMap(f => f.value.split(/\n|, /))) {
			assert.match(line, /^(<:war:\d+> )?`\d+` |^\+\d+ more$|^​$/, line);
		}
	});
});

describe('buildPostButtons', () => {
	it('should offer every answer for a raid, and Withdraw, My sign-up and Manage below', () => {
		const rows = buildPostButtons(raid()).map(r => r.toJSON().components as any[]);
		assert.deepEqual(rows.map(r => r.map(b => b.label)), [['Sign up', 'Late', 'Tentative', 'Absent'], ['Withdraw', 'My sign-up', 'Manage']]);
		assert.equal(rows[0][0].custom_id, 'event:e1:signed');
	});

	it('should offer Attending, Tentative and Absent for an event, with nothing to switch', () => {
		const event = raid();
		event.kind = 'event';
		const rows = buildPostButtons(event).map(r => r.toJSON().components.map((b: any) => b.label));
		assert.deepEqual(rows, [['Attending', 'Tentative', 'Absent'], ['Withdraw', 'Manage']]);
	});

	it('should disable answers once closed, keep Manage, and drop all buttons once cancelled', () => {
		const event = raid();
		event.closed = true;
		const rows = buildPostButtons(event).map(r => r.toJSON().components as any[]);
		assert.ok(rows[0].every(b => b.disabled));
		assert.deepEqual(rows[1].map(b => [b.label, !!b.disabled]), [['Withdraw', true], ['My sign-up', true], ['Manage', false]]);
		event.cancelled = true;
		assert.deepEqual(buildPostButtons(event), []);
	});
});

describe('signupReply', () => {
	it('should say what they signed up as, in the words on the buttons, and offer every other choice', () => {
		const event = raid();
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'retail', name: 'Thorvik', realm: 'Aggramar', classId: 'DEATHKNIGHT', specId: 'blood', offSpecId: 'frost' }, 'c1');
		const signup = respond(event, 'u1', 'Thor', 'signed', signupChoices(store.u1)[0]);
		const reply = signupReply(event, signup, store.u1, 'u1');
		assert.equal(reply.content, 'Signed up: **Thorvik**, Blood Death Knight (Tank)');
		const menu = reply.components[0].toJSON().components[0] as any;
		assert.deepEqual(menu.options.map((o: any) => [o.label, !!o.default]), [['Thorvik: Blood (Tank)', true], ['Thorvik: Frost (DPS)', false], ['Thorvik: Unholy (DPS)', false]]);
		assert.equal((reply.components[1].toJSON().components[0] as any).custom_id, 'characters:u1:home');
		respond(event, 'u1', 'Thor', 'late');
		assert.equal(signupReply(event, signup, store.u1, 'u1').content, 'Late: **Thorvik**, Blood Death Knight (Tank)');
	});

	it('should offer to sign up with a character when not signed up yet', () => {
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'retail', name: 'Thorvik', realm: 'Aggramar', classId: 'DEATHKNIGHT', specId: 'blood' }, 'c1');
		const reply = signupReply(raid(), undefined, store.u1, 'u1');
		assert.equal(reply.content, 'Not signed up. Pick a character to sign up with.');
		assert.equal((reply.components[0].toJSON().components[0] as any).options.length, 3);
		assert.equal(signupReply(raid(), undefined, [], 'u1').content, 'Not signed up, and no Retail character saved yet.');
	});
});

describe('roleQuestion', () => {
	it('should ask which role a two-role spec signs up as', () => {
		const event = raid('forever');
		const store: CharacterStore = {};
		addCharacter(store, 'u1', { game: 'forever', name: 'Thorvik', realm: '', classId: 'DRUID', specId: 'feral' }, 'c1');
		const question = roleQuestion(event, 'late', store.u1[0], 'feral', ['DPS', 'Tank']);
		assert.equal(question.content, '**Thorvik**, Feral Druid: which role?');
		assert.deepEqual(question.components[0].toJSON().components.map((b: any) => [b.label, b.custom_id]), [
			['DPS', 'event:e1:role:late:c1:feral:DPS'],
			['Tank', 'event:e1:role:late:c1:feral:Tank'],
		]);
	});
});

describe('buildEventModal', () => {
	it('should ask for title, start, description and whether it repeats', () => {
		const modal = buildEventModal('retail', 'raid').toJSON() as any;
		assert.equal(modal.title, 'New Retail raid');
		assert.equal(modal.custom_id, 'event:new:retail:raid');
		assert.deepEqual(modal.components.map((c: any) => c.label), ['Title', 'Start', 'Description', 'Repeat']);
		assert.equal(modal.components[1].description, 'Server time (Central European)');
	});

	it('should fill in a saved event when editing', () => {
		const modal = buildEventModal('retail', 'raid', { existing: raid() }).toJSON() as any;
		assert.equal(modal.custom_id, 'event:e1:save');
		assert.equal(modal.components[0].component.value, 'Mythic night');
		assert.equal(modal.components[1].component.value, '18/11/2026 19:30');
		assert.equal(modal.components[2].component.value, 'Bring flasks.');
	});
});

describe('off-spec icon', () => {
	it('should show a Forever DPS whose off-spec can tank, and nothing for an off-spec in the same role', () => {
		const event = raid('forever');
		signUp(event, 'u1', 'Moonkin', 'DRUID', 'balance', 'signed', 'feral');
		signUp(event, 'u2', 'Shocky', 'SHAMAN', 'elemental', 'signed', 'enhancement');
		signUp(event, 'u3', 'Furyboy', 'WARRIOR', 'fury', 'signed', 'arms');
		assert.deepEqual(fieldsOf(event)[2], ['⚔️ DPS 3', [
			':druid: `1` **Moonkin** Balance (🛡️) MoonkinDiscord',
			':shaman: `2` **Shocky** Elemental (🛡️) ShockyDiscord',
			':warrior: `3` **Furyboy** Fury FuryboyDiscord',
		].join('\n')]);
	});
});

describe('numbers on the post', () => {
	it('should count only the answers on the post, so withdrawing leaves no gap', () => {
		const event = raid('forever');
		signUp(event, 'u1', 'Elto', 'WARRIOR', 'arms');
		withdraw(event, 'u1');
		signUp(event, 'u1', 'Elto', 'WARRIOR', 'arms');
		assert.equal(fieldsOf(event)[2][1], ':warrior: `1` **Elto** Arms EltoDiscord');
	});

	it('should keep answering order across the roster and the lists below, and move a returning member to the end', () => {
		const event = raid('forever');
		signUp(event, 'u1', 'Elto', 'WARRIOR', 'arms');
		respond(event, 'u2', 'Stylz', 'absence');
		signUp(event, 'u3', 'Nel', 'MAGE', 'frost', 'tentative');
		withdraw(event, 'u1');
		signUp(event, 'u1', 'Elto', 'WARRIOR', 'arms');
		assert.deepEqual(fieldsOf(event).slice(2), [
			['⚔️ DPS 1', ':warrior: `3` **Elto** Arms EltoDiscord'],
			['❔ Tentative 1', '`2` :mage: Nel'],
			['🚫 Absent 1', '`1` Stylz'],
		]);
	});
});
