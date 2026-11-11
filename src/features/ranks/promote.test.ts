import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GuildMember } from 'discord.js';
import { config } from '../../core/config.js';
import promote from './promote.js';

const [visitorId, probationerId, memberId] = config.roles.ranks;
const guildId = 'guild';
const names: Record<string, string> = { [visitorId]: 'Visitor', [probationerId]: 'Probationer', [memberId]: 'Member' };

function fakeGuild(notEditable: string[] = [], manageRoles = true) {
	const roles = new Map(Object.entries(names).map(([id, name]) => [id, { name, editable: !notEditable.includes(id) }]));
	return { id: guildId, name: 'Test', roles: { cache: roles }, members: { me: { permissions: { has: () => manageRoles } } } };
}

// A member whose role changes are recorded instead of sent to Discord
function fakeMember(name: string, roleIds: string[], guild = fakeGuild()) {
	const calls: string[][] = [];
	const member = {
		displayName: name,
		user: { username: name.toLowerCase() },
		guild,
		roles: {
			cache: new Map([guildId, ...roleIds].map(id => [id, {}])),
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
		await assert.rejects(promote(officer, member), { message: 'Jay is already a Member.' });
		assert.deepEqual(calls, []);
	});
});
