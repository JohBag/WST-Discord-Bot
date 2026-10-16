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

	// In channels where the bot answers everything, every message is meant for it
	if (hasBotMention(interaction.mentions) || isMentionedByName(interaction.content) || reactChance === 1) {
		log('Responding to mention');
		return 'direct';
	}

	if (isRandomResponse(reactChance)) {
		log(`Random reply (${reactChance * 100}% chance)`);
		return 'random';
	}

	return null;
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
