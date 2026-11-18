import type { Client, MessageCreateOptions } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import { generateReply } from '../../ai/chat.js';
import { firedContent, voiceInstructions } from './format.js';
import { canPingHere, updateCard } from './actions.js';
import { loadReminders, saveReminders, takeDue } from './store.js';
import type { Reminder } from './store.js';

// Checks for due reminders and posts them in the channel they were set in, worded by Botty. One that
// came due while the bot was offline is posted at startup, marked with when it was due

const tickMs = 30 * 1000;
const voiceTimeoutMs = 30 * 1000;
const maxBodyLength = 1500;

export function startReminderTimer(client: Client): void {
	// A tick still waiting on Discord or the model makes the next one skip rather than run alongside it
	let running = false;
	const tick = async () => {
		if (running) {
			return;
		}
		running = true;
		try {
			await deliverDue(client);
		} catch (error) {
			log.error(`Reminder timer failed: ${error}`);
		} finally {
			running = false;
		}
	};
	tick();
	setInterval(tick, tickMs);
}

async function deliverDue(client: Client, now = Date.now()): Promise<void> {
	const store = loadReminders();
	const due = takeDue(store, now);
	if (due.length === 0) {
		return;
	}
	// Removed first, so a failed send isn't tried again every 30 seconds
	saveReminders(store);
	for (const reminder of due) {
		try {
			await deliver(client, reminder);
		} catch (error) {
			log.error(`Reminder #${reminder.number} failed: ${error}`);
		}
	}
}

async function deliver(client: Client, reminder: Reminder): Promise<void> {
	const channel = await client.channels.fetch(reminder.channelId);
	if (!channel?.isSendable()) {
		throw new Error(`can't post in channel ${reminder.channelId}`);
	}
	const roleName = reminder.roleId && 'guild' in channel ? channel.guild.roles.cache.get(reminder.roleId)?.name : undefined;
	if (reminder.target === 'channel' && 'guild' in channel && !canPingHere(channel.guild, channel.id)) {
		log.warn(`Reminder #${reminder.number}: no Mention Everyone in this channel any more, so @here won't ping`);
	}
	const body = await inVoice(reminder, roleName);
	const sent = await channel.send(firedMessage(reminder, body));
	log(`Reminder #${reminder.number} from ${reminder.userName} posted`);
	await updateCard(client, reminder, 'sent', { url: sent.url, at: sent.createdTimestamp });
}

// Only the one it's for gets pinged, whatever the model writes
export function firedMessage(reminder: Reminder, body: string, now = Date.now()): MessageCreateOptions {
	return {
		content: firedContent(reminder, body, now),
		reply: reminder.messageId ? { messageReference: reminder.messageId, failIfNotExists: false } : undefined,
		allowedMentions: {
			// "everyone" covers @here, which only a channel reminder carries (the text's are broken up)
			parse: reminder.target === 'channel' ? ['everyone'] : [],
			users: reminder.target === 'member' ? [reminder.userId] : [],
			roles: reminder.target === 'role' ? [reminder.roleId!] : [],
			repliedUser: false,
		},
	};
}

// The reminder in Botty's words, or as written when the model fails or takes too long
async function inVoice(reminder: Reminder, roleName: string | undefined): Promise<string> {
	try {
		const reply = await Promise.race([
			generateReply({
				model: config.models.text,
				systemPrompt: [config.prompt.trim(), voiceInstructions(reminder, roleName)].join('\n\n'),
				conversation: [{ author: reminder.userName, content: reminder.text, fromBot: false }],
				tools: false,
			}),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), voiceTimeoutMs)),
		]);
		const text = reply.text.trim();
		if (text) {
			return text.slice(0, maxBodyLength);
		}
		log.warn(`Reminder #${reminder.number}: the model wrote nothing, posting it as written`);
	} catch (error) {
		log.warn(`Reminder #${reminder.number}: couldn't word it (${error}), posting it as written`);
	}
	return reminder.text;
}
