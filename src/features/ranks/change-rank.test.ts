import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'discord.js';
import type { GuildMember } from 'discord.js';
import { config } from '../../core/config.js';
import changeRank from './change-rank.js';
import * as commands from '../../commands/index.js';

const promote = (officer: GuildMember, target: GuildMember) => changeRank(officer, target, 'up');
const demote = (officer: GuildMember, target: GuildMember) => changeRank(officer, target, 'down');

const [visitorId, probationerId, memberId] = config.roles.ranks;
const guildId = 'guild';
// The server's roles from bottom to top, with a guild master role above Officer
const serverRoles: [string, string][] = [
	[visitorId, 'Visitor'], ['raider', 'Raider'], [probationerId, 'Probationer'], [memberId, 'Member'],
	[config.roles.officer, 'Officer'], ['gm', 'Guild Master'],
];

function fakeGuild(notEditable: string[] = [], manageRoles = true) {
	const roles = new Collection(serverRoles.map(([id, name], index) => [id, { id, name, position: index + 1, editable: !notEditable.includes(id) }]));
	return { id: guildId, name: 'Test', roles: { cache: roles }, members: { me: { permissions: { has: () => manageRoles } } } };
}

// A member whose role changes are recorded instead of sent to Discord
function fakeMember(name: string, roleIds: string[], guild = fakeGuild()) {
	const calls: string[][] = [];
	const member = {
		id: name,
		displayName: name,
		user: { username: name.toLowerCase() },
		guild,
		roles: {
			cache: new Collection([guildId, ...roleIds].map(id => [id, guild.roles.cache.get(id) ?? { id, position: 0 }])),
			async set(ids: string[]) { calls.push(ids); },
		},
	};
	return { member: member as unknown as GuildMember, calls };
}

const officer = fakeMember('Officer', [config.roles.officer, memberId]).member;

describe('promote', () => {
	it('should swap Visitor for Probationer in one change and keep other roles', async () => {
		const { member, calls } = fakeMember('Jay', ['raider', visitorId]);
		assert.equal(await promote(officer, member), 'Jay is now a Probationer.');
		assert.deepEqual(calls, [['raider', probationerId]]);
	});

	it('should swap Probationer for Member', async () => {
		const { member, calls } = fakeMember('Jay', [probationerId]);
		assert.equal(await promote(officer, member), 'Jay is now a Member.');
		assert.deepEqual(calls, [[memberId]]);
	});

	it('should refuse anyone without the Officer role', async () => {
		const notOfficer = fakeMember('Bart', [memberId]).member;
		const { member, calls } = fakeMember('Jay', [visitorId]);
		await assert.rejects(promote(notOfficer, member), { message: 'Only officers can promote members.' });
		assert.deepEqual(calls, []);
	});

	it('should change nothing when a rank sits above Botty', async () => {
		const { member, calls } = fakeMember('Jay', [visitorId], fakeGuild([probationerId]));
		await assert.rejects(promote(officer, member), {
			message: "I can't hand out or take away Probationer. My role has to be above every rank in Server Settings > Roles.",
		});
		assert.deepEqual(calls, []);
	});

	it('should change nothing without the Manage Roles permission', async () => {
		const { member, calls } = fakeMember('Jay', [visitorId], fakeGuild([], false));
		await assert.rejects(promote(officer, member), { message: 'I need the Manage Roles permission to change ranks.' });
		assert.deepEqual(calls, []);
	});

	it('should refuse a Member', async () => {
		const { member, calls } = fakeMember('Jay', [memberId]);
		await assert.rejects(promote(officer, member), { message: 'Jay is already a Member, the highest rank.' });
		assert.deepEqual(calls, []);
	});
});

describe('demote', () => {
	it('should swap Member for Probationer in one change and keep other roles', async () => {
		const { member, calls } = fakeMember('Jay', ['raider', memberId]);
		assert.equal(await demote(officer, member), 'Jay is now a Probationer.');
		assert.deepEqual(calls, [['raider', probationerId]]);
	});

	it('should swap Probationer for Visitor', async () => {
		const { member, calls } = fakeMember('Jay', [probationerId]);
		assert.equal(await demote(officer, member), 'Jay is now a Visitor.');
		assert.deepEqual(calls, [[visitorId]]);
	});

	it('should refuse anyone without the Officer role', async () => {
		const notOfficer = fakeMember('Bart', [memberId]).member;
		const { member, calls } = fakeMember('Jay', [memberId]);
		await assert.rejects(demote(notOfficer, member), { message: 'Only officers can demote members.' });
		assert.deepEqual(calls, []);
	});

	it('should leave officers alone, including the officer running it', async () => {
		const target = fakeMember('Mochi', [config.roles.officer, memberId]);
		await assert.rejects(demote(officer, target.member), { message: "Mochi is an officer or above. Officers can't be demoted." });
		assert.deepEqual(target.calls, []);

		const self = fakeMember('Officer', [config.roles.officer, memberId]);
		await assert.rejects(demote(self.member, self.member), { message: "Officers can't be demoted, yourself included." });
		assert.deepEqual(self.calls, []);
	});

	it('should leave anyone with a role above Officer alone', async () => {
		const { member, calls } = fakeMember('Bart', ['gm', memberId]);
		await assert.rejects(demote(officer, member), { message: "Bart is an officer or above. Officers can't be demoted." });
		assert.deepEqual(calls, []);
	});

	it('should give an officer without a rank the officer message', async () => {
		const { member, calls } = fakeMember('Mochi', [config.roles.officer]);
		await assert.rejects(demote(officer, member), { message: "Mochi is an officer or above. Officers can't be demoted." });
		assert.deepEqual(calls, []);
	});

	it('should refuse a non-officer before saying anything about the target', async () => {
		const notOfficer = fakeMember('Jay', [memberId]).member;
		const { member, calls } = fakeMember('Mochi', [config.roles.officer, memberId]);
		await assert.rejects(demote(notOfficer, member), { message: 'Only officers can demote members.' });
		assert.deepEqual(calls, []);
	});

	it('should refuse a Visitor', async () => {
		const { member, calls } = fakeMember('Jay', [visitorId]);
		await assert.rejects(demote(officer, member), { message: 'Jay is already a Visitor, the lowest rank.' });
		assert.deepEqual(calls, []);
	});

	it('should change nothing when the rank being taken away sits above Botty', async () => {
		const { member, calls } = fakeMember('Jay', [memberId], fakeGuild([memberId]));
		await assert.rejects(demote(officer, member), {
			message: "I can't hand out or take away Member. My role has to be above every rank in Server Settings > Roles.",
		});
		assert.deepEqual(calls, []);
	});

	it('should drop a higher rank held alongside and change only that', async () => {
		const { member, calls } = fakeMember('Jay', [probationerId, memberId]);
		assert.equal(await demote(officer, member), 'Jay is now a Probationer.');
		assert.deepEqual(calls, [[probationerId]]);
	});

	it('should change nothing when the rank being given sits above Botty', async () => {
		const { member, calls } = fakeMember('Jay', [memberId], fakeGuild([probationerId]));
		await assert.rejects(demote(officer, member), {
			message: "I can't hand out or take away Probationer. My role has to be above every rank in Server Settings > Roles.",
		});
		assert.deepEqual(calls, []);
	});
});

// Each command has to move the member the way its name says
describe('rank commands', () => {
	const slash = (target: GuildMember) => ({ inCachedGuild: () => true, member: officer, options: { getMember: () => target } });
	const menu = (target: GuildMember) => ({ inCachedGuild: () => true, member: officer, targetMember: target });
	const cases = [
		{ command: commands.promote, name: 'promote', interaction: slash, expected: 'Jay is now a Member.' },
		{ command: commands.promoteMenu, name: 'Promote', interaction: menu, expected: 'Jay is now a Member.' },
		{ command: commands.demote, name: 'demote', interaction: slash, expected: 'Jay is now a Visitor.' },
		{ command: commands.demoteMenu, name: 'Demote', interaction: menu, expected: 'Jay is now a Visitor.' },
	];
	for (const { command, name, interaction, expected } of cases) {
		it(`${name} should reply "${expected}" for a Probationer`, async () => {
			const { member } = fakeMember('Jay', [probationerId]);
			assert.equal(command.data.name, name);
			assert.equal(await command.execute(interaction(member) as any), expected);
		});
	}

	it('should refuse someone who left the server', async () => {
		await assert.rejects(commands.demote.execute(slash(null as unknown as GuildMember) as any), { message: "That user isn't in the server." });
	});
});
