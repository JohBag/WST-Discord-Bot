import type { ReplyReason } from './situation.js';

// Writes one reply and returns when the history it is based on was read
export type WriteReply<T> = (trigger: T, reason: ReplyReason) => Promise<number>;

// Makes sure a channel gets one reply at a time. Direct messages that arrive while a reply is being
// written get one follow-up afterwards, unless they were already in the history that reply saw.
export class ReplyQueue<T extends { createdTimestamp: number }> {
	// Channels with a reply in progress, and the latest direct message that came in meanwhile
	private readonly busy = new Map<string, { next?: T }>();

	constructor(private readonly write: WriteReply<T>) {}

	async add(channelId: string, trigger: T, reason: ReplyReason): Promise<void> {
		const running = this.busy.get(channelId);
		if (running) {
			// Dropping in uninvited can wait for another time
			if (reason === 'direct') {
				running.next = trigger;
			}
			return;
		}

		const state: { next?: T } = {};
		this.busy.set(channelId, state);
		try {
			let current: T | undefined = trigger;
			let currentReason = reason;
			while (current) {
				const historyReadAt = await this.write(current, currentReason);
				const next: T | undefined = state.next;
				state.next = undefined;
				current = next && next.createdTimestamp > historyReadAt ? next : undefined;
				currentReason = 'direct';
			}
		} finally {
			this.busy.delete(channelId);
		}
	}
}
