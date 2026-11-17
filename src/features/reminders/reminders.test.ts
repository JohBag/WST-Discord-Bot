import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import UserError from '../../core/user-error.js';
import { parseDuration, parseReminderTime } from './time.js';
import { addReminder, cancelReminder, setConfirmation, takeDue, visibleTo } from './store.js';
import type { Reminder, ReminderStore } from './store.js';
import { confirmationCard, describeAgo, firedContent, listCard, listText, menuLabel, voiceInstructions } from './format.js';
import { firedMessage } from './deliver.js';
import { timeNote } from '../chat/situation.js';
import { pickAsker } from './chat-tools.js';

const minute = 60 * 1000;
const hour = 60 * minute;
// Tuesday 17 November 2026, 20:00 in Paris (UTC+1)
const now = Date.UTC(2026, 10, 17, 19, 0);

function base(overrides: Partial<Omit<Reminder, 'number'>> = {}): Omit<Reminder, 'number'> {
	return { target: 'member', userId: 'u1', userName: 'Kapi', guildId: 'g', channelId: 'c1', text: 'bring flasks', due: now + 2 * hour, createdAt: now, ...overrides };
}

function emptyStore(): ReminderStore {
	return { next: 1, reminders: [] };
}

describe('reminder times', () => {
	it('should read durations in short and long forms', () => {
		assert.equal(parseDuration('2h'), 120);
		assert.equal(parseDuration('1d 3h'), 27 * 60);
		assert.equal(parseDuration('in 90 minutes'), 90);
		assert.equal(parseDuration('1h30m'), 90);
		assert.equal(parseDuration('2 hours and 15 mins'), 135);
		assert.equal(parseDuration('1w'), 7 * 24 * 60);
		assert.equal(parseDuration('19:30'), undefined);
		assert.equal(parseDuration('fri 19:30'), undefined);
		assert.equal(parseDuration('2 bananas'), undefined);
	});

	it('should read clock times and days in server time, and ISO times from the chat', () => {
		assert.equal(parseReminderTime('2h', now), now + 2 * hour);
		assert.equal(parseReminderTime('21:30', now), Date.UTC(2026, 10, 17, 20, 30));
		assert.equal(parseReminderTime('fri 19:30', now), Date.UTC(2026, 10, 20, 18, 30));
		assert.equal(parseReminderTime('2026-11-18T08:00:00+01:00', now), Date.UTC(2026, 10, 18, 7, 0));
	});

	it('should take the ways people write times', () => {
		assert.equal(parseDuration('an hour'), 60);
		assert.equal(parseDuration('in half an hour'), 30);
		assert.equal(parseDuration('1.5h'), 90);
		assert.equal(parseDuration('2h30'), 150);
		assert.equal(parseReminderTime('at 21:30', now), Date.UTC(2026, 10, 17, 20, 30));
		assert.equal(parseReminderTime('tomorrow at 8', now), Date.UTC(2026, 10, 18, 7, 0));
		assert.equal(parseReminderTime('9pm', now), Date.UTC(2026, 10, 17, 20, 0));
		assert.equal(parseReminderTime('next fri 7:30pm', now), Date.UTC(2026, 10, 20, 18, 30));
	});

	it('should move a time already passed today to tomorrow', () => {
		assert.equal(parseReminderTime('08:00', now), Date.UTC(2026, 10, 18, 7, 0));
	});

	it('should read an ISO time without an offset as server time', () => {
		assert.equal(parseReminderTime('2026-11-18T08:00:00', now), Date.UTC(2026, 10, 18, 7, 0));
	});

	it('should keep the clock time for whole days across a daylight saving change', () => {
		// Saturday 28 March 2026, 20:00 in Paris (UTC+1). Summer time starts the next night
		const beforeChange = Date.UTC(2026, 2, 28, 19, 0);
		assert.equal(parseReminderTime('1d', beforeChange), Date.UTC(2026, 2, 29, 18, 0));
		assert.equal(parseReminderTime('24h', beforeChange), Date.UTC(2026, 2, 29, 19, 0));
		// 02:30 summer time on 25 October, the first of the two 02:30s
		const repeatedHour = Date.UTC(2026, 9, 25, 0, 30);
		assert.equal(parseReminderTime('2h', repeatedHour), repeatedHour + 2 * hour);
	});

	it('should take an hour and a half, and refuse durations too long to be a date', () => {
		assert.equal(parseDuration('an hour and a half'), 90);
		assert.deepEqual(parseReminderTime('100000000d', now), { error: 'Reminders can be set up to a year ahead.' });
		assert.deepEqual(parseReminderTime('in 20', now), { error: 'Is that minutes or a time? Write 20m or 20:00.' });
	});

	it('should say what is wrong with a time it cannot use', () => {
		assert.deepEqual(parseReminderTime('20', now), { error: 'Is that minutes or a time? Write 20m or 20:00.' });
		assert.deepEqual(parseReminderTime('soonish', now), { error: "I couldn't read the time. Write it like 2h, 1d 3h, 19:30 or Fri 19:30." });
		assert.deepEqual(parseReminderTime('0m', now), { error: "That's in the past." });
		assert.deepEqual(parseReminderTime('2026-11-17T08:00:00+01:00', now), { error: "That's in the past." });
		assert.deepEqual(parseReminderTime('400d', now), { error: 'Reminders can be set up to a year ahead.' });
	});
});

describe('reminder store', () => {
	it('should number reminders and keep channel and role reminders to officers', () => {
		const store = emptyStore();
		assert.equal(addReminder(store, base(), false).number, 1);
		assert.equal(addReminder(store, base({ target: 'channel' }), true).number, 2);
		assert.throws(() => addReminder(store, base({ target: 'role', roleId: 'r' }), false), new UserError('Only officers can set reminders for the channel or a role.'));
		assert.equal(store.next, 3);
	});

	it('should stop a member at 10 reminders', () => {
		const store = emptyStore();
		for (let i = 0; i < 10; i++) {
			addReminder(store, base(), false);
		}
		assert.throws(() => addReminder(store, base(), false), new UserError('You already have 10 reminders set. Cancel one with /reminders first.'));
		assert.equal(addReminder(store, base({ userId: 'u2' }), false).number, 11);
	});

	it('should show a member their own and this channel\'s, but never another member\'s own', () => {
		const store = emptyStore();
		addReminder(store, base({ due: now + 3 * hour }), false);
		addReminder(store, base({ due: now + hour, channelId: 'c2' }), false);
		addReminder(store, base({ userId: 'u2', text: 'secret' }), false);
		addReminder(store, base({ userId: 'u2', target: 'channel', text: 'reset' }), true);
		addReminder(store, base({ userId: 'u2', target: 'channel', channelId: 'c2' }), true);
		const seen = visibleTo(store, 'u1', 'c1');
		assert.deepEqual(seen.own.map(r => r.number), [2, 1]);
		assert.deepEqual(seen.channel.map(r => r.number), [4]);
	});

	it('should let members cancel their own, officers also channel reminders, and hide others\' own', () => {
		const store = emptyStore();
		addReminder(store, base({ userId: 'u2' }), false);
		addReminder(store, base({ userId: 'u2', target: 'channel' }), true);
		assert.throws(() => cancelReminder(store, 1, 'u1', true), new UserError("There's no reminder #1."));
		assert.throws(() => cancelReminder(store, 2, 'u1', false), new UserError('Only officers can cancel reminder #2.'));
		assert.equal(cancelReminder(store, 2, 'u1', true).number, 2);
		assert.equal(cancelReminder(store, 1, 'u2', false).number, 1);
		assert.equal(store.reminders.length, 0);
	});

	it('should take out only what is due, oldest first', () => {
		const store = emptyStore();
		addReminder(store, base({ due: now - minute }), false);
		addReminder(store, base({ due: now + minute }), false);
		addReminder(store, base({ due: now - hour }), false);
		assert.deepEqual(takeDue(store, now).map(r => r.number), [3, 1]);
		assert.deepEqual(store.reminders.map(r => r.number), [2]);
	});
});

describe('reminder text', () => {
	const reminder: Reminder = { ...base(), number: 12 };
	const due = Math.floor(reminder.due / 1000);

	it('should confirm on a card: what, when in each reader\'s own time zone, and who it pings', () => {
		const card = confirmationCard(reminder).toJSON();
		assert.equal(card.title, '⏰ Reminder #12');
		assert.equal(card.description, 'bring flasks');
		assert.equal(card.color, 0x0099FF);
		assert.deepEqual(card.fields, [
			{ name: 'When', value: `<t:${due}:f>\n<t:${due}:R>`, inline: true },
			{ name: 'For', value: '<@u1>', inline: true },
		]);
		assert.equal(card.footer, undefined);
		const role = confirmationCard({ ...reminder, target: 'role', roleId: 'r1' }).toJSON();
		assert.deepEqual(role.fields![1], { name: 'For', value: '<@&r1>', inline: true });
		assert.equal(role.footer?.text, 'Set by Kapi');
		assert.deepEqual(confirmationCard({ ...reminder, target: 'channel' }).toJSON().fields![1], { name: 'For', value: '<#c1>', inline: true });
	});

	it('should turn the card grey once sent, with when it went out and a link, or cancelled, struck out', () => {
		const at = reminder.due + 3 * hour;
		const sent = confirmationCard(reminder, 'sent', { url: 'https://discord.com/channels/g/c1/m9', at }).toJSON();
		assert.equal(sent.title, '✅ Reminder #12 sent');
		assert.equal(sent.color, 0x95A5A6);
		assert.deepEqual(sent.fields![0], { name: 'When', value: `<t:${Math.floor(at / 1000)}:f>\n[Jump to message](https://discord.com/channels/g/c1/m9)`, inline: true });
		const cancelled = confirmationCard(reminder, 'cancelled').toJSON();
		assert.equal(cancelled.title, '❌ Reminder #12 cancelled');
		assert.equal(cancelled.description, '~~bring flasks~~');
		assert.deepEqual(cancelled.fields, [{ name: 'When', value: `~~<t:${due}:f>~~`, inline: true }, { name: 'For', value: '<@u1>', inline: true }]);
	});

	it('should remember the card of a waiting reminder only', () => {
		const store = emptyStore();
		addReminder(store, base(), false);
		assert.equal(setConfirmation(store, 1, 'm5'), true);
		assert.equal(store.reminders[0].confirmationId, 'm5');
		assert.equal(setConfirmation(store, 2, 'm6'), false);
	});

	it('should list yours and the channel\'s under headings, with the channel of yours set elsewhere', () => {
		const channel: Reminder = { ...base({ target: 'channel', text: 'reset tonight' }), number: 13 };
		const elsewhere: Reminder = { ...base({ channelId: 'c2', text: 'vault' }), number: 14 };
		assert.equal(listText([reminder, elsewhere], [channel], 'c1'), [
			'**Your reminders**',
			`\`#12\` <t:${due}:f> (<t:${due}:R>) bring flasks`,
			`\`#14\` <t:${due}:f> (<t:${due}:R>) <#c2>: vault`,
			'',
			'**This channel**',
			`\`#13\` <t:${due}:f> (<t:${due}:R>) <#c1>: reset tonight`,
		].join('\n'));
		assert.equal(listText([], [], 'c1'), 'No reminders set. Set one with /remind, or ask me in chat.');
		assert.equal(listCard([], [], 'c1').toJSON().title, '⏰ Reminders');
	});

	it('should keep a list of long reminders within one card', () => {
		const long = Array.from({ length: 10 }, (_, i) => ({ ...base({ text: 'x'.repeat(500) }), number: i + 1 }));
		const others = Array.from({ length: 30 }, (_, i) => ({ ...base({ target: 'channel', userId: 'u2', text: 'y'.repeat(500) }), number: i + 11 }));
		const text = listText(long, others, 'c1');
		assert.ok(text.length <= 4096, `${text.length}`);
		assert.match(text, /\n\+\d+ more$/);
		assert.ok(text.includes('x'.repeat(79) + '…'));
	});

	it('should label the cancel menu with how far off it is, the same in every time zone', () => {
		assert.equal(menuLabel(reminder, now), '#12 in 2 hours: bring flasks');
		assert.equal(menuLabel({ ...reminder, due: now + hour }, now), '#12 in an hour: bring flasks');
	});

	it('should ping only the one it is for, whatever the text says', () => {
		const sent = firedMessage(reminder, 'Flask time, @everyone <@u9>', now + 2 * hour);
		assert.equal(sent.content, '⏰ <@u1> Flask time, @everyone <@u9>');
		assert.deepEqual(sent.allowedMentions, { users: ['u1'], roles: [], repliedUser: false });
		assert.equal(sent.reply, undefined);
		const role = firedMessage({ ...reminder, target: 'role', roleId: 'r1', messageId: 'm1' }, 'Reset tonight.', now + 2 * hour);
		assert.equal(role.content, '⏰ <@&r1> Reset tonight.\n-# Reminder from Kapi');
		assert.deepEqual(role.allowedMentions, { users: [], roles: ['r1'], repliedUser: false });
		assert.deepEqual(role.reply, { messageReference: 'm1', failIfNotExists: false });
	});

	it('should say who set a channel or role reminder, and when a late one was due', () => {
		const channel: Reminder = { ...reminder, target: 'channel' };
		assert.equal(firedContent(channel, 'Reset tonight.', reminder.due), '⏰ Reset tonight.\n-# Reminder from Kapi');
		assert.equal(firedContent({ ...reminder, target: 'role', roleId: 'r1', messageId: 'm1' }, 'Keys!', reminder.due), '⏰ <@&r1> Keys!\n-# Reminder from Kapi');
		assert.equal(firedContent(reminder, 'Flasks!', reminder.due + 3 * hour), `⏰ <@u1> Flasks!\n-# Due <t:${due}:R>`);
		assert.equal(firedContent(channel, 'Reset tonight.', reminder.due + 3 * hour), `⏰ Reset tonight.\n-# Reminder from Kapi, due <t:${due}:R>`);
	});

	it('should tell the model who set it, how long ago, and for whom', () => {
		const text = voiceInstructions(reminder, undefined, now + 3 * hour);
		assert.match(text, /^You're posting a reminder right now\. Kapi asked you 3 hours ago to remind them,/);
		assert.match(voiceInstructions({ ...reminder, target: 'role', roleId: 'r1' }, 'Raiders', now), /to remind everyone with the Raiders role/);
		assert.equal(describeAgo(minute), 'a minute ago');
		assert.equal(describeAgo(hour), 'an hour ago');
		assert.equal(describeAgo(3 * 24 * hour), '3 days ago');
	});
});

describe('who asked, in chat', () => {
	const kapi = { userId: 'u1', displayName: 'Kapi', username: 'kapi_', member: null, messageId: 'm2' };
	const seru = { userId: 'u2', displayName: 'Seru', username: 'seru', member: null, messageId: 'm1' };

	it('should pick the person the model named, by server or user name', () => {
		assert.equal(pickAsker([kapi, seru], 'Seru'), seru);
		assert.equal(pickAsker([kapi, seru], '@kapi_'), kapi);
	});

	it('should refuse a name that matches nobody who spoke to Botty, even with one person writing', () => {
		assert.equal(pickAsker([kapi], 'Seru'), undefined);
		assert.equal(pickAsker([kapi, seru], 'Leesha'), undefined);
	});

	it('should give a request with no name to the only person writing', () => {
		assert.equal(pickAsker([kapi, { ...kapi, messageId: 'm0' }], ''), kapi);
		assert.equal(pickAsker([kapi, seru], undefined), undefined);
	});
});

describe('timeNote', () => {
	it('should give the date and time in server time with the offset', () => {
		assert.equal(timeNote(now), "It's Tuesday 17 November 2026, 20:00 server time (EU realms, GMT+01:00).");
	});
});
