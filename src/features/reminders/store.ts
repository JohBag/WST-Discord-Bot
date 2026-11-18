import { load, save } from '../../core/storage.js';
import UserError from '../../core/user-error.js';

// Reminders waiting to fire, in the git-ignored config/reminders.json so they survive restarts.
// Anyone can set one for themselves. Officers can also set one for the channel or a role.

export type ReminderTarget = 'member' | 'channel' | 'role';

export interface Reminder {
	// Shown as #12 in confirmations and lists, so "cancel that" can find it in the chat
	number: number;
	target: ReminderTarget;
	// Who set it, and who gets pinged for a member reminder
	userId: string;
	userName: string;
	roleId?: string;
	guildId: string;
	channelId: string;
	// The chat message that asked for it, which the reminder replies to. None for /remind
	messageId?: string;
	text: string;
	due: number;
	createdAt: number;
	// The card that confirmed it in chat, updated once it's sent or cancelled
	confirmationId?: string;
}

export interface ReminderStore {
	next: number;
	reminders: Reminder[];
}

export const maxPerMember = 10;
export const maxTextLength = 500;

const fileName = 'reminders';

export function loadReminders(): ReminderStore {
	const store = load<Partial<ReminderStore>>(fileName);
	return { next: store.next ?? 1, reminders: store.reminders ?? [] };
}

export function saveReminders(store: ReminderStore): void {
	save(fileName, store);
}

// Adds one and returns it. Throws UserError for what the member can fix
export function addReminder(store: ReminderStore, reminder: Omit<Reminder, 'number'>, isOfficer: boolean): Reminder {
	if (reminder.target !== 'member' && !isOfficer) {
		throw new UserError('Only officers can set reminders for the channel or a role.');
	}
	// The ping goes in front when it fires, so one typed into the text would show twice
	const text = reminder.text.trim().replace(/^(@(here|everyone)[\s,:]*)+/i, '').trim();
	if (!text) {
		throw new UserError('What should I remind about?');
	}
	if (store.reminders.filter(r => r.userId === reminder.userId).length >= maxPerMember) {
		throw new UserError(`You already have ${maxPerMember} reminders set. Cancel one with /reminders first.`);
	}
	const added = { ...reminder, text: text.slice(0, maxTextLength), number: store.next };
	store.next += 1;
	store.reminders.push(added);
	return added;
}

// What a member sees in their list: everything they set, and the channel and role reminders others
// set in this channel. Other members' own reminders stay private
export function visibleTo(store: ReminderStore, userId: string, channelId: string): { own: Reminder[]; channel: Reminder[] } {
	const byDue = (a: Reminder, b: Reminder) => a.due - b.due;
	return {
		own: store.reminders.filter(r => r.userId === userId).sort(byDue),
		channel: store.reminders.filter(r => r.userId !== userId && r.target !== 'member' && r.channelId === channelId).sort(byDue),
	};
}

// A member cancels what they set. Officers can also cancel anyone's channel and role reminders
export function canCancel(reminder: Reminder, userId: string, isOfficer: boolean): boolean {
	return reminder.userId === userId || (isOfficer && reminder.target !== 'member');
}

// Removes it and returns it. Throws UserError when it isn't there or isn't theirs to cancel
export function cancelReminder(store: ReminderStore, number: number, userId: string, isOfficer: boolean): Reminder {
	const index = store.reminders.findIndex(r => r.number === number);
	const reminder = store.reminders[index];
	// Someone else's own reminder reads as missing, so its text isn't given away
	if (!reminder || (reminder.target === 'member' && reminder.userId !== userId)) {
		throw new UserError(`There's no reminder #${number}.`);
	}
	if (!canCancel(reminder, userId, isOfficer)) {
		throw new UserError(`Only officers can cancel reminder #${number}.`);
	}
	store.reminders.splice(index, 1);
	return reminder;
}

// Remembers the card that confirmed it, when it's still waiting
export function setConfirmation(store: ReminderStore, number: number, messageId: string): boolean {
	const reminder = store.reminders.find(r => r.number === number);
	if (reminder) {
		reminder.confirmationId = messageId;
	}
	return !!reminder;
}

// Takes out the reminders that are due, oldest first
export function takeDue(store: ReminderStore, now = Date.now()): Reminder[] {
	const due = store.reminders.filter(r => r.due <= now).sort((a, b) => a.due - b.due);
	store.reminders = store.reminders.filter(r => r.due > now);
	return due;
}
