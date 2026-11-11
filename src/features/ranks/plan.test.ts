import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planPromotion } from './plan.js';

const visitor = { id: 'v', name: 'Visitor' };
const probationer = { id: 'p', name: 'Probationer' };
const member = { id: 'm', name: 'Member' };
const ranks = [visitor, probationer, member];

describe('planPromotion', () => {
	it('should promote a Visitor to Probationer, take Visitor away and keep other roles', () => {
		assert.deepEqual(planPromotion('Jay', ['raider', 'v'], ranks), {
			from: visitor, to: probationer, roles: ['raider', 'p'], changed: ['v', 'p'],
		});
	});

	it('should promote a Probationer to Member and take Probationer away', () => {
		assert.deepEqual(planPromotion('Jay', ['p'], ranks), {
			from: probationer, to: member, roles: ['m'], changed: ['p', 'm'],
		});
	});

	it('should go up from the highest rank held and take every lower rank away', () => {
		assert.deepEqual(planPromotion('Jay', ['v', 'p'], ranks), {
			from: probationer, to: member, roles: ['m'], changed: ['v', 'p', 'm'],
		});
	});

	it('should refuse a Member', () => {
		assert.deepEqual(planPromotion('Jay', ['m'], ranks), { error: 'Jay is already a Member.' });
	});

	it('should refuse someone without a rank', () => {
		assert.deepEqual(planPromotion('Jay', ['other'], ranks), {
			error: "Jay isn't a Visitor, Probationer or Member, so there's no rank to promote from.",
		});
	});
});
