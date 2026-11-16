// Reading the start time officers type ("wed 19:30", "26/11 19:30") in EU server time, and writing
// it back for the edit form. Discord shows the stored moment in each reader's own time zone.

// EU realms run on Central European time
export const serverTimeZone = 'Europe/Paris';

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface WallClock {
	year: number;
	month: number; // 1-12
	day: number;
	hour: number;
	minute: number;
	weekday: number; // 0 = Sunday
}

// What a clock in the time zone shows at a moment
export function wallClock(ms: number, timeZone = serverTimeZone): WallClock {
	const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric', month: 'numeric', day: 'numeric',
		hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'long',
	}).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		weekday: weekdays.indexOf(parts.weekday.toLowerCase()),
	};
}

// The moment a clock in the time zone shows the given date and time
export function fromWallClock(year: number, month: number, day: number, hour: number, minute: number, timeZone = serverTimeZone): number {
	const asUtc = Date.UTC(year, month - 1, day, hour, minute);
	// The zone's offset at that moment, found by reading the clock there. Checked twice to land on
	// the right side of a daylight saving change
	let guess = asUtc;
	for (let i = 0; i < 2; i++) {
		const shown = wallClock(guess, timeZone);
		const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
		guess = asUtc - (shownAsUtc - guess);
	}
	return guess;
}

function addDays(clock: WallClock, days: number): { year: number; month: number; day: number } {
	const date = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + days));
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export const whenHint = 'Write it like Wed 19:30 or 26/11 19:30.';

// Reads a start time. Returns the moment, or an error to show
export function parseWhen(text: string, now = Date.now(), timeZone = serverTimeZone): number | { error: string } {
	const input = text.trim().toLowerCase().replace(/\s+/g, ' ');
	const timeMatch = input.match(/(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?$/);
	if (!timeMatch) {
		return { error: `I couldn't read the time. ${whenHint}` };
	}
	const hour = Number(timeMatch[1]);
	const minute = Number(timeMatch[2] ?? 0);
	if (hour > 23 || minute > 59) {
		return { error: `I couldn't read the time. ${whenHint}` };
	}
	const datePart = input.slice(0, timeMatch.index).trim();
	const today = wallClock(now, timeZone);

	let date: { year: number; month: number; day: number } | undefined;
	let rollYear = false;
	if (datePart === '' || datePart === 'today') {
		date = today;
	} else if (datePart === 'tomorrow') {
		date = addDays(today, 1);
	} else if (/^[a-z]{3,}$/.test(datePart)) {
		const weekday = weekdays.findIndex(name => name.startsWith(datePart));
		if (weekday === -1) {
			return { error: `I couldn't read the day. ${whenHint}` };
		}
		// The next one, or today if the time is still ahead
		let ahead = (weekday - today.weekday + 7) % 7;
		if (ahead === 0 && fromWallClock(today.year, today.month, today.day, hour, minute, timeZone) <= now) {
			ahead = 7;
		}
		date = addDays(today, ahead);
	} else {
		const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
		const european = datePart.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
		if (iso) {
			date = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
		} else if (european) {
			const year = european[3] ? Number(european[3].length === 2 ? `20${european[3]}` : european[3]) : today.year;
			date = { year, month: Number(european[2]), day: Number(european[1]) };
			rollYear = !european[3];
		} else {
			return { error: `I couldn't read the date. ${whenHint}` };
		}
		const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
		if (check.getUTCMonth() !== date.month - 1 || check.getUTCDate() !== date.day) {
			return { error: `There's no such date. ${whenHint}` };
		}
	}

	let start = fromWallClock(date.year, date.month, date.day, hour, minute, timeZone);
	// A day and month without a year that has already been means next year's
	if (rollYear && start <= now) {
		start = fromWallClock(date.year + 1, date.month, date.day, hour, minute, timeZone);
	}
	if (start <= now) {
		return { error: "That's in the past." };
	}
	return start;
}

// For the edit form: the full date, so a past event isn't read as next year's
export function formatWhen(ms: number, timeZone = serverTimeZone): string {
	const c = wallClock(ms, timeZone);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(c.day)}/${pad(c.month)}/${c.year} ${pad(c.hour)}:${pad(c.minute)}`;
}
