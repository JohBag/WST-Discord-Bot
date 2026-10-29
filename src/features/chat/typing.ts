// Who is writing a message in each channel, from Discord's "is typing" signal, so a reply can wait
// for someone's second thought instead of answering the first half
const typing = new Map<string, Map<string, number>>();

// Discord shows "is typing" for about 10 seconds per signal, and clients send it again while typing goes on
const typingMs = 10000;

export function startedTyping(channelId: string, userId: string, now = Date.now()): void {
	if (!typing.has(channelId)) {
		typing.set(channelId, new Map());
	}
	typing.get(channelId)!.set(userId, now + typingMs);
}

// Sending a message ends that user's typing
export function sentMessage(channelId: string, userId: string): void {
	typing.get(channelId)?.delete(userId);
}

export function isAnyoneTyping(channelId: string, now = Date.now()): boolean {
	const users = typing.get(channelId);
	if (!users) {
		return false;
	}
	for (const [userId, until] of users) {
		if (until > now) {
			return true;
		}
		users.delete(userId);
	}
	return false;
}
