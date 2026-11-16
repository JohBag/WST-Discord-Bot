import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDetails, durationMinutes, endOf, syncStep } from './calendar.js';
import { createEvent } from './store.js';
import type { RaidEvent } from './store.js';

const hour = 60 * 60 * 1000;
const start = 10 * hour;

function event(fields: Partial<RaidEvent> = {}): RaidEvent {
	return {
		...createEvent({ game: 'retail', kind: 'raid', title: 'Mythic night', description: 'Bring flasks.', start, leaderId: 'l', leaderName: 'Leesha', channelId: 'chan' }, 0, 'e1'),
		messageId: 'msg',
		...fields,
	};
}

describe('durations', () => {
	it('should last 2 hours for raids and events, from config', () => {
		assert.equal(durationMinutes('raid'), 120);
		assert.equal(durationMinutes('event'), 120);
		assert.equal(endOf(event()), start + 2 * hour);
	});
});

describe('calendarDetails', () => {
	it('should give the title, description, start, end and the post as its location', () => {
		const details = calendarDetails(event(), 'guild');
		assert.equal(details.name, 'Mythic night');
		assert.equal(details.description, 'Bring flasks.');
		assert.equal(details.scheduledStartTime.getTime(), start);
		assert.equal(details.scheduledEndTime.getTime(), start + 2 * hour);
		assert.equal(details.entityMetadata.location, 'https://discord.com/channels/guild/chan/msg');
	});

	it('should send an empty description as null, so a cleared one is cleared on the entry too', () => {
		assert.equal(calendarDetails(event({ description: '' }), 'guild').description, null);
	});
});

describe('syncStep', () => {
	it('should create an entry for an upcoming event without one, but not for one that has begun', () => {
		assert.equal(syncStep(event(), 'none', start - hour), 'create');
		assert.equal(syncStep(event(), 'none', start + 1), 'none');
	});

	it('should update a waiting entry, and only its details once it is live', () => {
		assert.equal(syncStep(event(), 'scheduled', start - hour), 'update');
		assert.equal(syncStep(event(), 'active', start + 1), 'update-details');
	});

	it('should end a live entry and make a new one when the start moves later', () => {
		assert.equal(syncStep(event({ start: start + 24 * hour }), 'active', start + hour), 'restart');
	});

	it('should make a new entry when an ended or removed one is moved to the future', () => {
		assert.equal(syncStep(event(), 'over', start - hour), 'create');
		assert.equal(syncStep(event(), 'none', start - hour), 'create');
		assert.equal(syncStep(event(), 'over', start + 3 * hour), 'none');
	});

	it('should cancel a waiting entry and end a live one when the event is cancelled', () => {
		assert.equal(syncStep(event({ cancelled: true }), 'scheduled'), 'cancel');
		assert.equal(syncStep(event({ cancelled: true }), 'active'), 'complete');
		assert.equal(syncStep(event({ cancelled: true }), 'over'), 'none');
		assert.equal(syncStep(event({ cancelled: true }), 'none'), 'none');
	});
});
