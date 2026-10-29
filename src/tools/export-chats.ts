// Saves recent conversations the bot replied to, for npm run compare.
// Needs the production bot's token to read the guild, so it runs on the VM: npm run vm -- chats
//
// node --env-file=.env dist/tools/export-chats.js [--count 20] [--scan 3000] [--channel <id> ...]
import fs from 'fs';
import { parseArgs } from 'util';
import { ChannelType, REST, Routes } from 'discord.js';
import type { APIChannel, APIGuildMember, APIMessage, APIUser } from 'discord.js';
import { config, secrets } from '../core/config.js';
import { filterHistory } from '../features/chat/conversation.js';
import getChannelSettings from '../features/chat/channel-settings.js';
import { isMentionedByName } from '../features/chat/should-respond.js';
import { describeMessage, quote } from '../features/chat/describe.js';
import type { ChatMessage } from '../ai/conversation.js';
import { conversationsDir } from './eval.js';
import type { EvalConversation } from './eval.js';

const { values } = parseArgs({
	options: {
		// How many conversations to save, most recent first
		count: { type: 'string', default: '20' },
		// How many messages to read per channel
		scan: { type: 'string', default: '3000' },
		channel: { type: 'string', multiple: true },
	},
});

const rest = new REST().setToken(secrets.discord.botToken!);
const bot = await rest.get(Routes.user()) as APIUser;

const names = new Map<string, Promise<string>>();

// Server nicknames, like the bot uses when it builds a conversation
function getName(user: APIUser): Promise<string> {
	if (!names.has(user.id)) {
		names.set(user.id, (rest.get(Routes.guildMember(config.guildId, user.id)) as Promise<APIGuildMember>)
			.then(member => member.nick ?? user.global_name ?? user.username)
			.catch(() => user.global_name ?? user.username));
	}
	return names.get(user.id)!;
}

async function getChannels(): Promise<APIChannel[]> {
	const channels = await rest.get(Routes.guildChannels(config.guildId)) as APIChannel[];
	const wanted = values.channel;
	return channels.filter(channel => wanted
		? wanted.includes(channel.id)
		: channel.type === ChannelType.GuildText && !(channel.id in config.blacklist));
}

// Oldest first
async function getMessages(channelId: string, count: number): Promise<APIMessage[]> {
	const messages: APIMessage[] = [];
	let before: string | undefined;
	while (messages.length < count) {
		const query = new URLSearchParams({ limit: String(Math.min(100, count - messages.length)) });
		if (before) {
			query.set('before', before);
		}
		const page = await rest.get(Routes.channelMessages(channelId), { query }) as APIMessage[];
		messages.push(...page);
		if (page.length < 100) {
			break;
		}
		before = page.at(-1)!.id;
	}
	return messages.reverse();
}

// Mentions and custom emoji as names, like the bot reads them with discord.js's cleanContent
async function readableContent(message: APIMessage): Promise<string> {
	let content = message.content;
	for (const user of message.mentions) {
		content = content.replace(new RegExp(`<@!?${user.id}>`, 'g'), `@${await getName(user)}`);
	}
	return content.replace(/<a?(:\w+:)\d+>/g, '$1');
}

// What the bot reads of a message; pictures stay notes, since the comparison is text only
async function readMessage(message: APIMessage): Promise<string> {
	return describeMessage({
		text: await readableContent(message),
		attachments: message.attachments.map(attachment => ({ contentType: attachment.content_type, url: attachment.url, size: attachment.size })),
		embeds: message.embeds.map(embed => ({ type: embed.type, title: embed.title, description: embed.description })),
	});
}

async function toChatMessage(message: APIMessage, content: string): Promise<ChatMessage> {
	const fromBot = message.author.id === bot.id;
	const original = message.referenced_message;
	return {
		author: await getName(message.author),
		content,
		fromBot,
		replyTo: original && !fromBot
			? { author: original.author.id === bot.id ? 'you' : await getName(original.author), content: quote(await readMessage(original)) }
			: undefined,
	};
}

// Plain chat replies; posts with pictures, log summaries and votes can't be compared as text
function isChatReply(message: APIMessage): boolean {
	return message.author.id === bot.id
		&& message.content.trim() !== ''
		&& message.attachments.length === 0
		&& !message.embeds.some(embed => embed.type === 'rich')
		&& !message.components?.length;
}

const timestamp = (message: APIMessage) => Date.parse(message.timestamp);

async function findConversations(channel: APIChannel): Promise<EvalConversation[]> {
	const messages = await getMessages(channel.id, Number(values.scan));
	const { reactChance } = getChannelSettings(channel.id);
	const { maxMessages } = config.chat.history;
	const conversations: EvalConversation[] = [];
	// Where the last saved conversation starts. Replies inside it are skipped, since a busy thread
	// would otherwise give many conversations that are almost the same.
	let savedFrom = messages.length;

	for (let i = messages.length - 1; i >= 0; i--) {
		const reply = messages[i];
		if (i >= savedFrom || !isChatReply(reply)) {
			continue;
		}

		// What the bot saw: the messages before its reply, filtered like it filters them
		const before = (await Promise.all(messages.slice(Math.max(0, i - maxMessages), i)
			.map(async message => ({ message, createdTimestamp: timestamp(message), content: await readMessage(message) }))))
			.reverse();
		const history = filterHistory(before, timestamp(reply)).reverse();
		if (history.length === 0 || history.at(-1)!.message.author.id === bot.id) {
			continue;
		}

		// Decided like the bot decides, from the message it replied to
		const last = history.at(-1)!.message;
		const direct = reactChance === 1 || last.mentions.some(user => user.id === bot.id) || isMentionedByName(last.content);

		conversations.push({
			id: `${channel.name}-${reply.id}`,
			channel: channel.name ?? undefined,
			date: reply.timestamp,
			messages: await Promise.all(history.map(({ message, content }) => toChatMessage(message, content))),
			original: reply.content,
			reason: direct ? 'direct' : 'random',
		});
		savedFrom = i - history.length;
	}
	return conversations;
}

const all: EvalConversation[] = [];
for (const channel of await getChannels()) {
	try {
		const found = await findConversations(channel);
		console.log(`#${channel.name}: ${found.length} replies`);
		all.push(...found);
	} catch (error) {
		// Channels the bot can't read
		console.log(`#${channel.name}: skipped (${error instanceof Error ? error.message : error})`);
	}
}

const newest = all.sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, Number(values.count));
fs.mkdirSync(conversationsDir, { recursive: true });
const file = `${conversationsDir}/discord.json`;
fs.writeFileSync(file, JSON.stringify(newest, null, '\t'));
console.log(`Saved ${newest.length} conversations to ${file}`);
