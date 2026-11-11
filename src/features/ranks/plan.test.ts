import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planRankChange } from './plan.js';

const visitor = { id: 'v', name: 'Visitor' };
const probationer = { id: 'p', name: 'Probationer' };
const member = { id: 'm', name: 'Member' };
const ranks = [visitor, probationer, member];

describe('planRankChange up', () => {
	it('should promote a Visitor to Probationer, take Visitor away and keep other roles', () => {
		assert.deepEqual(planRankChange('Jay', ['raider', 'v'], ranks, 'up'), {
			from: visitor, to: probationer, roles: ['raider', 'p'], changed: ['v', 'p'],
		});
	});

	it('should promote a Probationer to Member and take Probationer away', () => {
		assert.deepEqual(planRankChange('Jay', ['p'], ranks, 'up'), {
			from: probationer, to: member, roles: ['m'], changed: ['p', 'm'],
		});
	});

	it('should go up from the highest rank held and take every lower rank away', () => {
		assert.deepEqual(planRankChange('Jay', ['v', 'p'], ranks, 'up'), {
			from: probationer, to: member, roles: ['m'], changed: ['v', 'p', 'm'],
		});
	});

	it('should refuse a Member', () => {
		assert.deepEqual(planRankChange('Jay', ['m'], ranks, 'up'), { error: 'Jay is already a Member, the highest rank.' });
	});

	it('should refuse someone without a rank', () => {
		assert.deepEqual(planRankChange('Jay', ['other'], ranks, 'up'), {
			error: "Jay isn't a Visitor, Probationer or Member, so there's no rank to promote from.",
		});
	});
});

describe('planRankChange down', () => {
	it('should demote a Member to Probationer, take Member away and keep other roles', () => {
		assert.deepEqual(planRankChange('Jay', ['raider', 'm'], ranks, 'down'), {
			from: member, to: probationer, roles: ['raider', 'p'], changed: ['m', 'p'],
		});
	});

	it('should demote a Probationer to Visitor', () => {
		assert.deepEqual(planRankChange('Jay', ['p'], ranks, 'down'), {
			from: probationer, to: visitor, roles: ['v'], changed: ['p', 'v'],
		});
	});

	it('should keep a lower rank already held instead of adding it again', () => {
		assert.deepEqual(planRankChange('Jay', ['v', 'p'], ranks, 'down'), {
			from: probationer, to: visitor, roles: ['v'], changed: ['p'],
		});
	});

	it('should refuse a Visitor', () => {
		assert.deepEqual(planRankChange('Jay', ['v'], ranks, 'down'), { error: 'Jay is already a Visitor, the lowest rank.' });
	});

	it('should refuse someone without a rank', () => {
		assert.deepEqual(planRankChange('Jay', [], ranks, 'down'), {
			error: "Jay isn't a Visitor, Probationer or Member, so there's no rank to demote from.",
		});
	});
});
