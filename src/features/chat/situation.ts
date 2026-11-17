import { serverTimeZone } from '../events/when.js';

// Why the bot is replying changes what a good reply looks like, so the prompt gets a line about it
export type ReplyReason = 'direct' | 'random';

const situations: Record<ReplyReason, string> = {
	direct: 'Someone is talking to you, so reply to the latest message.',
	random: 'Nobody asked for you: you\'re dropping into the conversation on your own. Keep it to one short line that fits the vibe, and don\'t offer help or start anything.',
};

const searchNote = 'You can search the web. When someone asks about something current, such as patches, balance, events or news, look it up instead of saying you\'re unsure. Never search for banter.';

// Messages carry no timestamps, so the model needs the time for reminders and "what day is raid"
export function timeNote(now: number): string {
	// Built from parts, since how the whole date is punctuated differs between Node versions
	const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
		timeZone: serverTimeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
		hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
	}).formatToParts(now).map(part => [part.type, part.value]));
	return `It's ${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} server time (EU realms, ${p.timeZoneName}).`;
}

export function buildSystemPrompt(prompt: string, reason: ReplyReason, webSearch: boolean, now = Date.now()): string {
	return [prompt.trim(), situations[reason], webSearch ? searchNote : '', timeNote(now)].filter(Boolean).join('\n\n');
}
