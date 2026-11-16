import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWhen, fromWallClock, parseWhen, wallClock } from './when.js';

// Monday 2026-11-16 12:00 in Paris (CET, UTC+1)
const now = Date.UTC(2026, 10, 16, 11, 0);

function parsed(text: string, at = now): string {
	const result = parseWhen(text, at);
	assert.equal(typeof result, 'number', typeof result === 'number' ? '' : result.error);
	return new Date(result as number).toISOString();
}

describe('fromWallClock', () => {
	it('should read Paris time in winter and summer', () => {
		assert.equal(new Date(fromWallClock(2026, 11, 26, 19, 30)).toISOString(), '2026-11-26T18:30:00.000Z');
		assert.equal(new Date(fromWallClock(2027, 7, 1, 19, 30)).toISOString(), '2027-07-01T17:30:00.000Z');
	});

	it('should give back what the clock shows', () => {
		const clock = wallClock(fromWallClock(2027, 3, 28, 20, 0));
		assert.deepEqual([clock.year, clock.month, clock.day, clock.hour, clock.minute], [2027, 3, 28, 20, 0]);
	});
});

describe('parseWhen', () => {
	it('should read a weekday as the next one', () => {
		assert.equal(parsed('wed 19:30'), '2026-11-18T18:30:00.000Z');
		assert.equal(parsed('Wednesday 19.30'), '2026-11-18T18:30:00.000Z');
		assert.equal(parsed('sun 20'), '2026-11-22T19:00:00.000Z');
	});

	it("should read today's weekday as today while the time is ahead, else next week", () => {
		assert.equal(parsed('mon 19:30'), '2026-11-16T18:30:00.000Z');
		assert.equal(parsed('mon 11:00'), '2026-11-23T10:00:00.000Z');
	});

	it('should read today, tomorrow and a bare time', () => {
		assert.equal(parsed('19:30'), '2026-11-16T18:30:00.000Z');
		assert.equal(parsed('today 19:30'), '2026-11-16T18:30:00.000Z');
		assert.equal(parsed('tomorrow 19:30'), '2026-11-17T18:30:00.000Z');
	});

	it('should read day and month, rolling into next year once past', () => {
		assert.equal(parsed('26/11 19:30'), '2026-11-26T18:30:00.000Z');
		assert.equal(parsed('26.11 19:30'), '2026-11-26T18:30:00.000Z');
		assert.equal(parsed('3/1 19:30'), '2027-01-03T18:30:00.000Z');
		assert.equal(parsed('26/11/2026 19:30'), '2026-11-26T18:30:00.000Z');
		assert.equal(parsed('2026-11-26 19:30'), '2026-11-26T18:30:00.000Z');
	});

	it('should explain what it could not read', () => {
		assert.deepEqual(parseWhen('wed', now), { error: "I couldn't read the time. Write it like Wed 19:30 or 26/11 19:30." });
		assert.deepEqual(parseWhen('wed 25:00', now), { error: "I couldn't read the time. Write it like Wed 19:30 or 26/11 19:30." });
		assert.deepEqual(parseWhen('someday 19:30', now), { error: "I couldn't read the day. Write it like Wed 19:30 or 26/11 19:30." });
		assert.deepEqual(parseWhen('31/02 19:30', now), { error: "There's no such date. Write it like Wed 19:30 or 26/11 19:30." });
		assert.deepEqual(parseWhen('16/11/2026 10:00', now), { error: "That's in the past." });
		assert.deepEqual(parseWhen('11:00', now), { error: "That's in the past." });
	});
});

describe('formatWhen', () => {
	it('should write the full date in Paris time, which parseWhen reads back', () => {
		const start = Date.UTC(2026, 10, 26, 18, 30);
		assert.equal(formatWhen(start), '26/11/2026 19:30');
		assert.equal(parseWhen(formatWhen(start), now), start);
	});
});
