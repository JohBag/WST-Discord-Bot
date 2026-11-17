import { fromWallClock, parseWhen, serverTimeZone, wallClock, whenHint } from '../events/when.js';

// Reading when a reminder is due: a duration from now ("2h", "1d 3h", "in half an hour") or a clock
// time and day in EU server time, the same forms the event form takes ("20:00", "fri 19:30")

export const reminderHint = 'Write it like 2h, 1d 3h, 19:30 or Fri 19:30.';

const maxAheadMs = 366 * 24 * 60 * 60 * 1000;

const units: [RegExp, number][] = [
	[/^(w|wk|wks|weeks?)$/, 7 * 24 * 60],
	[/^(d|days?)$/, 24 * 60],
	[/^(h|hr|hrs|hours?)$/, 60],
	[/^(m|min|mins|minutes?)$/, 1],
];

const dayMinutes = 24 * 60;

// Minutes in a duration, or undefined when the text isn't one
export function parseDuration(text: string): number | undefined {
	const parts = durationParts(text);
	return parts && parts.days * dayMinutes + parts.minutes;
}

// Days and weeks apart from hours and minutes, since only whole days keep the clock time
function durationParts(text: string): { days: number; minutes: number } | undefined {
	let input = text.trim().toLowerCase().replace(/^in\s+/, '')
		.replace(/\bhalf an? hour\b/g, '30m')
		.replace(/\ban? hour and a half\b/g, '90m')
		.replace(/\ban? day and a half\b/g, '1d 12h')
		.replace(/\ban? (hour|day|week|minute)\b/g, '1 $1')
		// "2h30" is 2 hours 30 minutes
		.replace(/(\d)h(\d+)$/, '$1h $2m');
	input = input.replace(/\s+/g, ' ');
	const parts = [...input.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/g)];
	// Every character has to belong to a number and its unit
	if (parts.length === 0 || parts.map(p => p[0]).join('').replace(/\s/g, '') !== input.replace(/\s|,(?!\d)|\band\b/g, '')) {
		return undefined;
	}
	let days = 0;
	let minutes = 0;
	for (const [, amount, unit] of parts) {
		const match = units.find(([pattern]) => pattern.test(unit));
		if (!match) {
			return undefined;
		}
		const value = Number(amount.replace(',', '.')) * match[1];
		if (match[1] >= dayMinutes) {
			days += Math.floor(value / dayMinutes);
			minutes += value % dayMinutes;
		} else {
			minutes += value;
		}
	}
	return { days, minutes: Math.round(minutes) };
}

// Whole days keep the clock time across a daylight saving change: "1d" at 20:00 is 20:00 tomorrow
function addDuration(now: number, { days, minutes: rest }: { days: number; minutes: number }): number {
	// Hours and minutes alone are exact, even in the hour that repeats when summer time ends
	if (days === 0) {
		return now + rest * 60 * 1000;
	}
	const clock = wallClock(now);
	const seconds = now % 60000;
	const sameTime = fromWallClock(clock.year, clock.month, clock.day + days, clock.hour, clock.minute) + seconds;
	return sameTime + rest * 60 * 1000;
}

// "7pm" and "7:30 pm" as 19:00 and 19:30, "at" and "next" dropped
function normalizeClock(text: string): string {
	return text.toLowerCase()
		.replace(/\b(at|next|on|in)\b/g, ' ')
		.replace(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/, (_, h, m, half) => {
			const hour = (Number(h) % 12) + (half === 'pm' ? 12 : 0);
			return `${hour}:${m ?? '00'}`;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

// An ISO 8601 time from the chat tool. Without an offset it's read as server time
function parseIso(text: string): number {
	if (/(z|[+-]\d{2}:?\d{2})$/i.test(text)) {
		return Date.parse(text);
	}
	const m = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	return m ? fromWallClock(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), serverTimeZone) : NaN;
}

// The moment it's due, or an error to show
export function parseReminderTime(text: string, now = Date.now()): number | { error: string } {
	const trimmed = text.trim();
	let due: number;
	if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
		due = parseIso(trimmed);
		if (Number.isNaN(due)) {
			return { error: `I couldn't read the time. ${reminderHint}` };
		}
	} else {
		const duration = durationParts(trimmed);
		if (duration && duration.days * dayMinutes + duration.minutes > maxAheadMs / 60000) {
			return { error: 'Reminders can be set up to a year ahead.' };
		}
		if (duration) {
			due = addDuration(now, duration);
		} else {
			const clock = normalizeClock(trimmed);
			// "20" could be minutes or 20:00
			if (/^\d+$/.test(clock)) {
				return { error: `Is that minutes or a time? Write ${clock}m or ${clock.padStart(2, '0')}:00.` };
			}
			let parsed = parseWhen(clock, now);
			// A time with no day that has passed today means tomorrow
			if (typeof parsed !== 'number' && /^\d{1,2}[:.]\d{2}$/.test(clock)) {
				parsed = parseWhen(`tomorrow ${clock}`, now);
			}
			if (typeof parsed !== 'number') {
				return { error: parsed.error.replace(whenHint, reminderHint) };
			}
			due = parsed;
		}
	}
	if (due <= now) {
		return { error: "That's in the past." };
	}
	if (due - now > maxAheadMs) {
		return { error: 'Reminders can be set up to a year ahead.' };
	}
	return due;
}
