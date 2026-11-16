import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyToLaterWeeks, buildEventModal } from './event-actions.js';
import { eventForLog, logUrl } from './logs.js';
import { overlap } from './logs.js';
import { reminderDue, reminderMessages, reminderPings, reminderText } from './reminders.js';
import { createSeries, dueStarts, passedWeek, seriesEvent, shiftLike, weekAfter } from './series.js';
import { createEvent, respond } from './store.js';
import type { RaidEvent } from './store.js';
import { fromWallClock } from './when.js';

const hour = 60 * 60 * 1000;
const day = 24 * hour;

// Wednesday 2026-11-18 19:30 server time
const wednesday = fromWallClock(2026, 11, 18, 19, 30);

function raid(fields: Partial<RaidEvent> = {}): RaidEvent {
	return {
		...createEvent({ game: 'retail', kind: 'raid', title: 'Mythic night', description: 'Flasks', start: wednesday, leaderId: 'l', leaderName: 'Leesha', channelId: 'c', guildId: 'g' }, wednesday - 5 * day, 'e1'),
		messageId: 'm',
		...fields,
	};
}

describe('weekAfter', () => {
	it('should keep the server time across a daylight saving change', () => {
		// Sunday 2027-03-21 20:00 to Sunday 2027-03-28 20:00, the day the clocks go forward
		const before = fromWallClock(2027, 3, 21, 20, 0);
		assert.equal(weekAfter(before), fromWallClock(2027, 3, 28, 20, 0));
		assert.equal(weekAfter(before) - before, 7 * day - hour);
		assert.equal(weekAfter(wednesday), fromWallClock(2026, 11, 25, 19, 30));
	});
});

describe('dueStarts', () => {
	const series = createSeries(raid(), 's1');

	it("should post next week's once this week's raid starts, a week ahead", () => {
		assert.deepEqual(dueStarts(series, wednesday - hour), []);
		assert.deepEqual(dueStarts(series, wednesday), [weekAfter(wednesday)]);
	});

	it('should skip weeks that started while Botty was offline, and post the one still ahead', () => {
		const now = wednesday + 15 * day;
		const second = weekAfter(weekAfter(wednesday));
		const third = weekAfter(second);
		assert.equal(passedWeek(series, now), second);
		assert.deepEqual(dueStarts({ ...series, lastStart: passedWeek(series, now) }, now), [third]);
	});

	it('should keep offering a week until it is posted, so a failed post is tried again', () => {
		const later = wednesday + hour;
		assert.deepEqual(dueStarts(series, later), [weekAfter(wednesday)]);
		assert.deepEqual(dueStarts({ ...series, lastStart: weekAfter(wednesday) }, later), []);
	});

	it('should copy the series into a new post for the week', () => {
		const event = seriesEvent(series, weekAfter(wednesday));
		assert.deepEqual([event.title, event.description, event.leaderName, event.channelId, event.seriesId, event.signups.length], ['Mythic night', 'Flasks', 'Leesha', 'c', 's1', 0]);
		assert.equal(event.start, weekAfter(wednesday));
	});
});

describe('reminders', () => {
	it('should be due from an hour before the start until the start, once', () => {
		assert.equal(reminderDue(raid(), wednesday - hour - 1), false);
		assert.equal(reminderDue(raid(), wednesday - hour), true);
		assert.equal(reminderDue(raid(), wednesday), false);
		assert.equal(reminderDue(raid({ reminded: true }), wednesday - hour), false);
		assert.equal(reminderDue(raid({ cancelled: true }), wednesday - hour), false);
	});

	it('should skip an event whose reminder an officer switched off', () => {
		assert.equal(reminderDue(raid({ noReminder: true }), wednesday - hour), false);
	});

	it('should give a series week the series reminder setting', () => {
		const series = { ...createSeries(raid({ noReminder: true }), 's1') };
		assert.equal(series.noReminder, true);
		assert.equal(seriesEvent(series, weekAfter(wednesday)).noReminder, true);
		assert.equal(seriesEvent(createSeries(raid(), 's2'), weekAfter(wednesday)).noReminder, undefined);
	});

	it('should skip an event posted after its reminder time', () => {
		assert.equal(reminderDue(raid({ createdAt: wednesday - 30 * 60 * 1000 }), wednesday - 10 * 60 * 1000), false);
	});

	it('should ping signed up, Late and Tentative in answering order, not Absent', () => {
		const event = raid();
		respond(event, 'u1', 'A', 'tentative');
		respond(event, 'u2', 'B', 'absence');
		respond(event, 'u3', 'C', 'late');
		respond(event, 'u4', 'D', 'signed');
		const pings = reminderPings(event);
		assert.deepEqual(pings, ['u1', 'u3', 'u4']);
		assert.equal(reminderText(event, pings), `**Mythic night** starts <t:${wednesday / 1000}:R>.\n<@u1> <@u3> <@u4>`);
	});

	it('should still go out with nobody signed up, without pings', () => {
		assert.deepEqual(reminderMessages(raid(), []), [{ content: `**Mythic night** starts <t:${wednesday / 1000}:R>.`, users: [] }]);
	});

	it('should split a big event into messages of at most 60 pings, each under 2000 characters', () => {
		const pings = Array.from({ length: 130 }, (_, i) => String(100000000000000000n + BigInt(i)));
		const messages = reminderMessages(raid(), pings);
		assert.deepEqual(messages.map(m => m.users.length), [60, 60, 10]);
		assert.ok(messages.every(m => m.content.length <= 2000));
		assert.match(messages[0].content, /^\*\*Mythic night\*\* starts/);
		assert.match(messages[1].content, /^<@/);
	});
});

describe('eventForLog', () => {
	const night = (start: number, end = start + 2 * hour) => ({ code: 'abc', startTime: start, endTime: end });

	it("should find the retail raid whose time the log overlaps, give or take an hour", () => {
		assert.equal(eventForLog({ e1: raid() }, night(wednesday + 10 * 60 * 1000))?.id, 'e1');
		assert.equal(eventForLog({ e1: raid() }, night(wednesday - 2 * hour, wednesday - 30 * 60 * 1000))?.id, 'e1');
		assert.equal(eventForLog({ e1: raid() }, night(wednesday + 4 * hour)), undefined);
	});

	it('should leave Forever raids, plain events and cancelled raids alone', () => {
		const log = night(wednesday);
		assert.equal(eventForLog({ e1: raid({ game: 'forever' }) }, log), undefined);
		assert.equal(eventForLog({ e1: raid({ kind: 'event' }) }, log), undefined);
		assert.equal(eventForLog({ e1: raid({ cancelled: true }) }, log), undefined);
	});

	it('should measure how much of the raid a log covers', () => {
		assert.equal(overlap(raid(), night(wednesday, wednesday + 2 * hour)), 2 * hour);
		assert.equal(overlap(raid(), night(wednesday - 3 * hour, wednesday - 2 * hour)), 0);
	});

	it('should pick the raid that started closest to the log', () => {
		const store = { early: raid({ id: 'early', start: wednesday - 2 * hour }), late: raid({ id: 'late' }) };
		assert.equal(eventForLog(store, night(wednesday + 5 * 60 * 1000))?.id, 'late');
		assert.equal(logUrl('abc'), 'https://www.warcraftlogs.com/reports/abc/');
	});
});

describe('shiftLike', () => {
	it('should put a later week as many weeks after the new start as it was after the old one', () => {
		// This week was moved to Tuesday on its own earlier, now to Thursday for all: later weeks go to Thursday
		const tuesday = fromWallClock(2026, 11, 17, 19, 30);
		const thursday = fromWallClock(2026, 11, 19, 19, 0);
		assert.equal(shiftLike(weekAfter(wednesday), tuesday, thursday), fromWallClock(2026, 11, 26, 19, 0));
		assert.equal(shiftLike(wednesday, wednesday, thursday), thursday);
	});

	it('should move a later week the same days, to the same new time of day', () => {
		const nextWednesday = weekAfter(wednesday);
		// Wed 19:30 to Thu 20:00
		const thursday = fromWallClock(2026, 11, 19, 20, 0);
		assert.equal(shiftLike(nextWednesday, wednesday, thursday), fromWallClock(2026, 11, 26, 20, 0));
		// Only the time
		assert.equal(shiftLike(nextWednesday, wednesday, fromWallClock(2026, 11, 18, 20, 0)), fromWallClock(2026, 11, 25, 20, 0));
	});

	it('should keep the server time for a later week across a daylight saving change', () => {
		const before = fromWallClock(2027, 3, 24, 19, 30);
		const after = fromWallClock(2027, 3, 31, 19, 30);
		assert.equal(shiftLike(after, before, fromWallClock(2027, 3, 24, 20, 0)), fromWallClock(2027, 3, 31, 20, 0));
	});
});

describe('applyToLaterWeeks', () => {
	it('should give later weeks and the series the new title, description and time, and leave earlier weeks', () => {
		const series = createSeries(raid(), 's1');
		const earlier = raid({ id: 'w0', seriesId: 's1', start: wednesday - 7 * day });
		const thisWeek = raid({ id: 'w1', seriesId: 's1' });
		const nextWeek = raid({ id: 'w2', seriesId: 's1', start: weekAfter(wednesday), reminded: true });
		series.lastStart = nextWeek.start;
		const store = { w0: earlier, w1: thisWeek, w2: nextWeek };
		const oldStart = thisWeek.start;
		thisWeek.title = 'Heroic night';
		thisWeek.description = 'New plan';
		thisWeek.start = fromWallClock(2026, 11, 18, 20, 0);
		const changed = applyToLaterWeeks(store, thisWeek, oldStart, series, wednesday - day);
		assert.deepEqual(changed.map(e => e.id), ['w2']);
		assert.deepEqual([nextWeek.title, nextWeek.description, nextWeek.start, nextWeek.reminded], ['Heroic night', 'New plan', fromWallClock(2026, 11, 25, 20, 0), false]);
		assert.deepEqual([earlier.title, earlier.start], ['Mythic night', wednesday - 7 * day]);
		assert.deepEqual([series.title, series.description, series.lastStart], ['Heroic night', 'New plan', fromWallClock(2026, 11, 25, 20, 0)]);
	});

	it('should keep the time of a later week that has already begun', () => {
		const thisWeek = raid({ id: 'w1', seriesId: 's1' });
		const started = raid({ id: 'w2', seriesId: 's1', start: weekAfter(wednesday) });
		const oldStart = thisWeek.start;
		thisWeek.start = fromWallClock(2026, 11, 18, 20, 0);
		applyToLaterWeeks({ w1: thisWeek, w2: started }, thisWeek, oldStart, undefined, weekAfter(wednesday) + hour);
		assert.equal(started.start, weekAfter(wednesday));
	});

	it('should leave the times alone when only the title changes', () => {
		const series = createSeries(raid(), 's1');
		const thisWeek = raid({ id: 'w1', seriesId: 's1' });
		const nextWeek = raid({ id: 'w2', seriesId: 's1', start: weekAfter(wednesday), reminded: true });
		thisWeek.title = 'Renamed';
		applyToLaterWeeks({ w1: thisWeek, w2: nextWeek }, thisWeek, thisWeek.start, series);
		assert.deepEqual([nextWeek.title, nextWeek.start, nextWeek.reminded, series.lastStart], ['Renamed', weekAfter(wednesday), true, wednesday]);
	});
});

describe('the Apply to choice', () => {
	it('should be in the edit form only for a week of a repeating raid', () => {
		const repeating = buildEventModal('retail', 'raid', { existing: raid({ seriesId: 's1' }), repeating: true }).toJSON() as any;
		assert.deepEqual(repeating.components.map((c: any) => c.label), ['Title', 'Start', 'Apply to', 'Description']);
		assert.deepEqual(repeating.components[2].component.options.map((o: any) => [o.label, !!o.default]), [['This event', true], ['This and repeating events', false]]);
		const single = buildEventModal('retail', 'raid', { existing: raid() }).toJSON() as any;
		assert.deepEqual(single.components.map((c: any) => c.label), ['Title', 'Start', 'Description']);
	});
});

describe('the Repeat choice', () => {
	it('should be in the form when creating, not when editing', () => {
		const create = buildEventModal('retail', 'raid').toJSON() as any;
		assert.deepEqual(create.components.map((c: any) => c.label), ['Title', 'Start', 'Repeat', 'Reminder', 'Description']);
		assert.deepEqual(create.components[3].component.options.map((o: any) => [o.label, !!o.default]), [['Ping an hour before', true], ['No reminder', false]]);
		assert.deepEqual(create.components[2].component.options.map((o: any) => [o.label, !!o.default]), [["Doesn't repeat", true], ['Every week', false]]);
		const edit = buildEventModal('retail', 'raid', { existing: raid() }).toJSON() as any;
		assert.deepEqual(edit.components.map((c: any) => c.label), ['Title', 'Start', 'Description']);
	});
});
