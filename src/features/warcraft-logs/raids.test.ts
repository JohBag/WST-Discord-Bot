import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupRaidNights, isRaid } from './raids.js';
import type { Fight, Report } from './raids.js';

const hour = 60 * 60 * 1000;
const raidStart = Date.UTC(2026, 9, 14, 18, 30);

function fight(difficulty: number, id = 1): Fight {
	return { id, name: 'Boss', difficulty, kill: false, fightPercentage: 50 };
}

function report(code: string, overrides: Partial<Report> = {}): Report {
	return {
		code,
		startTime: raidStart,
		endTime: raidStart + 2 * hour,
		zone: { id: 53, name: 'The Venomous Abyss' },
		owner: { id: 1, name: 'Uploader' },
		guild: { id: 66538 },
		fights: [fight(4)],
		...overrides,
	};
}

describe('isRaid', () => {
	it('should accept Normal, Heroic and Mythic raids', () => {
		for (const difficulty of [3, 4, 5]) {
			assert.equal(isRaid(report('a', { fights: [fight(difficulty)] })), true);
		}
	});

	it('should reject Mythic+, LFR and reports without boss pulls', () => {
		assert.equal(isRaid(report('a', { fights: [fight(10)] })), false);
		assert.equal(isRaid(report('a', { fights: [fight(1)] })), false);
		assert.equal(isRaid(report('a', { fights: [] })), false);
	});
});

describe('groupRaidNights', () => {
	it('should group overlapping reports of the same zone into one night', () => {
		const nights = groupRaidNights([
			report('guild'),
			report('autolog', { guild: null, startTime: raidStart + 10 * 60 * 1000 }),
		]);
		assert.equal(nights.length, 1);
		assert.deepEqual(nights[0].codes.sort(), ['autolog', 'guild']);
	});

	it('should prefer the guild report over a more complete personal one', () => {
		const [night] = groupRaidNights([
			report('personal', { guild: null, fights: [fight(4, 1), fight(4, 2), fight(4, 3)] }),
			report('guild'),
		]);
		assert.equal(night.report.code, 'guild');
	});

	it('should prefer the report with the most pulls when none is a guild report', () => {
		const [night] = groupRaidNights([
			report('short', { guild: null }),
			report('long', { guild: null, fights: [fight(4, 1), fight(4, 2)] }),
		]);
		assert.equal(night.report.code, 'long');
	});

	it('should keep separate nights apart, newest first', () => {
		const nights = groupRaidNights([
			report('wednesday'),
			report('sunday', { startTime: raidStart + 96 * hour, endTime: raidStart + 98 * hour }),
		]);
		assert.deepEqual(nights.map(night => night.report.code), ['sunday', 'wednesday']);
	});

	it('should not group overlapping reports from different zones', () => {
		const nights = groupRaidNights([report('a'), report('b', { zone: { id: 54, name: 'Other raid' } })]);
		assert.equal(nights.length, 2);
	});

	it('should drop non-raid reports and duplicates of the same code', () => {
		const nights = groupRaidNights([report('raid'), report('raid'), report('dungeon', { fights: [fight(10)] })]);
		assert.deepEqual(nights.map(night => night.codes), [['raid']]);
	});
});
