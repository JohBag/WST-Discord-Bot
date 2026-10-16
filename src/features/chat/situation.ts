// Why the bot is replying changes what a good reply looks like, so the prompt gets a line about it
export type ReplyReason = 'direct' | 'random';

const situations: Record<ReplyReason, string> = {
	direct: 'Someone is talking to you, so reply to the latest message.',
	random: 'Nobody asked for you: you\'re dropping into the conversation on your own. Keep it to one short line that fits the vibe, and don\'t offer help or start anything.',
};

const searchNote = 'You can search the web. When someone asks about something current, such as patches, balance, events or news, look it up instead of saying you\'re unsure. Never search for banter.';

export function buildSystemPrompt(prompt: string, reason: ReplyReason, webSearch: boolean): string {
	return [prompt.trim(), situations[reason], webSearch ? searchNote : ''].filter(Boolean).join('\n\n');
}
