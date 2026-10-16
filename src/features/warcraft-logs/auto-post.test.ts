import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findPostedRaid, getSignature } from './auto-post.js';
import type { PostedRaid } from './auto-post.js';
import type { RaidNight, Report } from './raids.js';

const hour = 60 * 60 * 1000;
const raidStart = Date.UTC(2026, 9, 14, 18, 30);

const report: Report = {
	code: 'abc',
	startTime: raidStart,
	endTime: raidStart + 2 * hour,
	zone: { id: 53, name: 'The Venomous Abyss' },
	owner: { id: 1, name: 'Uploader' },
	guild: { id: 66538 },
	fights: [{ id: 1, name: 'Boss', difficulty: 4, kill: true, fightPercentage: 0 }],
};

function posted(overrides: Partial<PostedRaid> = {}): PostedRaid {
	return {
		codes: ['abc'],
		zoneId: 53,
		startTime: raidStart,
		endTime: raidStart + 2 * hour,
		messageId: '1',
		signature: '',
		...overrides,
	};
}

describe('findPostedRaid', () => {
	it('should match a night that shares a report code', () => {
		const night: RaidNight = { report, codes: ['abc'] };
		assert.ok(findPostedRaid([posted()], night));
	});

	it('should match a new report of an already posted raid', () => {
		const night: RaidNight = { report: { ...report, code: 'later-upload' }, codes: ['later-upload'] };
		assert.ok(findPostedRaid([posted()], night));
	});

	it('should not match a raid on another day', () => {
		const night: RaidNight = { report: { ...report, code: 'new', startTime: raidStart + 72 * hour, endTime: raidStart + 74 * hour }, codes: ['new'] };
		assert.equal(findPostedRaid([posted()], night), undefined);
	});
});

describe('getSignature', () => {
	it('should change when new pulls are logged', () => {
		const later = { ...report, fights: [...report.fights, report.fights[0]] };
		assert.notEqual(getSignature(report), getSignature(later));
	});

	it('should change when the raid stops being live', () => {
		const duringRaid = report.endTime + 5 * 60 * 1000;
		const afterRaid = report.endTime + 60 * 60 * 1000;
		assert.notEqual(getSignature(report, duringRaid), getSignature(report, afterRaid));
	});
});
