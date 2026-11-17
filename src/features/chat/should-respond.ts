import log from '../../core/log.js';
import { config, secrets } from '../../core/config.js';
import { ChatInputCommandInteraction } from 'discord.js';
import type { Message, MessageMentions } from 'discord.js';
import type { ReplyReason } from './situation.js';

// Whether to reply and why, or null to stay quiet
export default function shouldRespond(interaction: Message | ChatInputCommandInteraction, reactChance: number): ReplyReason | null {
	if (interaction instanceof ChatInputCommandInteraction) {
		return 'direct';
	}

	if (interaction.author.bot) {
		return null;
	}

	if (isInBlacklistedChannel(interaction.channelId)) {
		return null;
	}

	if (isAddressed(interaction)) {
		log('Responding to mention');
		return 'direct';
	}

	// In channels where the bot answers everything, every message is meant for it unless it's aimed at someone else
	if (reactChance === 1) {
		if (isForSomeoneElseThanBot(interaction)) {
			log('Not responding: the message is for someone else');
			return null;
		}
		return 'direct';
	}

	if (isRandomResponse(reactChance)) {
		log(`Random reply (${reactChance * 100}% chance)`);
		return 'random';
	}

	return null;
}

// Pinged, named, or replied to. Replying to one of the bot's messages is talking to it, whether or not the reply pings
function isAddressed(message: Message): boolean {
	return hasBotMention(message.mentions) || isMentionedByName(message.content) || message.mentions.repliedUser?.id === secrets.discord.appId;
}

function isForSomeoneElseThanBot(message: Message): boolean {
	const others = [...message.mentions.users.keys(), message.mentions.repliedUser?.id];
	return isForSomeoneElse(message.author.id, others, secrets.discord.appId!);
}

// Whether a message is meant for the bot, the way a direct reply decides it, without the random chance
export function isToBot(message: Message, reactChance: number): boolean {
	if (message.author.bot) {
		return false;
	}
	return isAddressed(message) || (reactChance === 1 && !isForSomeoneElseThanBot(message));
}

// Whether a message replies to or pings someone other than its author and the bot
export function isForSomeoneElse(authorId: string, mentionedIds: (string | undefined)[], botId: string): boolean {
	return mentionedIds.some(id => id !== undefined && id !== authorId && id !== botId);
}

function isInBlacklistedChannel(channelId: string): boolean {
	return channelId in config.blacklist;
}

function hasBotMention(mentions: MessageMentions): boolean {
	return mentions.users.size > 0 && mentions.users.has(secrets.discord.appId!);
}

export function isMentionedByName(content: string): boolean {
	return config.nicknames.some(name => content.toLowerCase().includes(name));
}

function isRandomResponse(reactChance: number): boolean {
	if (reactChance === 0) {
		return false;
	}
	if (reactChance === 1) {
		return true;
	}

	const rng = Math.random();
	return rng > (1 - reactChance);
}
