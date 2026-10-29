import { setTimeout as sleep } from 'timers/promises';
import type { ReplyReason } from './situation.js';

const typingCheckMs = 250;

// Writes one reply and returns when the newest message it saw was sent
export type WriteReply<T> = (trigger: T, reason: ReplyReason) => Promise<number>;

interface ChannelState<T> {
	// The latest direct message that came in while a reply was being written
	next?: T;
	lastArrival: number;
}

// Makes sure a channel gets one reply at a time. A burst of pings ("botty", "BOTTY", "you there?")
// is waited out and answered together, and so is a second message someone is still typing. Pings
// the reply didn't see get a single follow-up.
export class ReplyQueue<T extends { createdTimestamp: number }> {
	private readonly busy = new Map<string, ChannelState<T>>();

	constructor(
		private readonly write: WriteReply<T>,
		private readonly isTyping: (channelId: string) => boolean,
		// Replies start once the channel has been quiet for quietMs with nobody typing, or after maxWaitMs at the latest
		private readonly gather = { quietMs: 1500, maxWaitMs: 10000 },
	) {}

	async add(channelId: string, trigger: T, reason: ReplyReason): Promise<void> {
		const running = this.busy.get(channelId);
		if (running) {
			running.lastArrival = Date.now();
			// Dropping in uninvited can wait for another time
			if (reason === 'direct') {
				running.next = trigger;
			}
			return;
		}

		const state: ChannelState<T> = { lastArrival: Date.now() };
		this.busy.set(channelId, state);
		try {
			let current: T | undefined = trigger;
			let currentReason = reason;
			while (current) {
				await this.waitForQuiet(channelId, state);
				const seenUntil = await this.write(current, currentReason);
				const next: T | undefined = state.next;
				state.next = undefined;
				current = next && next.createdTimestamp > seenUntil ? next : undefined;
				currentReason = 'direct';
			}
		} finally {
			this.busy.delete(channelId);
		}
	}

	private async waitForQuiet(channelId: string, state: ChannelState<T>): Promise<void> {
		const { quietMs, maxWaitMs } = this.gather;
		const started = Date.now();
		for (;;) {
			const quietFor = Date.now() - state.lastArrival;
			const waited = Date.now() - started;
			if (waited >= maxWaitMs || (quietFor >= quietMs && !this.isTyping(channelId))) {
				return;
			}
			// Typing has no end signal other than the message arriving, so check again shortly
			const untilQuiet = quietFor < quietMs ? quietMs - quietFor : typingCheckMs;
			await sleep(Math.min(untilQuiet, maxWaitMs - waited));
		}
	}
}
