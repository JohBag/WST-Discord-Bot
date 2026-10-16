import { ChatInputCommandInteraction, Collection } from 'discord.js';
import type { InteractionEditReplyOptions, SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface Config {
	name: string;
	nicknames: string[];
	models: {
		// A claude-* or gemini-* model
		text: string;
		image: string;
	};
	chat: {
		cutoff: string;
		ageLimitDays: number;
		// Lets the model look up current information on the web, at a small cost per search
		webSearch: boolean;
		// How much of the channel the model sees: the current conversation, which ends at a pause
		// longer than gapMinutes, but at least minMessages and at most maxMessages
		history: {
			minMessages: number;
			maxMessages: number;
			gapMinutes: number;
		};
	};
	channelSettings: {
		default: ChannelSettings;
		[channelId: string]: Partial<ChannelSettings>;
	};
	blacklist: Record<string, string>;
	media: {
		imageFile: string;
	};
	music: {
		// Multiplier applied to every song; below 1 keeps it in the background
		volume: number;
	};
	newUsersRoleId: string;
	guildId: string;
	warcraftLogs: {
		guildId: number;
		// Channel that /log and automatic posts go to
		channelId: string;
		// Warcraft Logs user IDs whose personal raid logs also count as guild raids
		uploaderIds: number[];
		autoPost: boolean;
		pollMinutes: number;
	};
	prompt: string;
}

export interface ChannelSettings {
	reactChance: number;
}

export interface Secrets {
	discord: {
		appId: string | undefined;
		botToken: string | undefined;
	};
	keys: {
		gemini: string | undefined;
		anthropic: string | undefined;
		warcraftLogs: string | undefined;
	};
}

export interface BotCommand {
	data: SlashCommandOptionsOnlyBuilder;
	// Returning text or message content keeps it as the (private) reply; otherwise the reply is removed
	execute(interaction: ChatInputCommandInteraction): Promise<void | string | InteractionEditReplyOptions>;
}

export interface BotEvent {
	name: string;
	once?: boolean;
	execute(...args: any[]): Promise<void>;
}

export interface Vote {
	title: string;
	description?: string;
	options: Record<string, number | Record<string, string>>;
	voters: string[];
	anonymity: boolean;
	creatorId?: string;
}

declare module 'discord.js' {
	interface Client {
		commands: Collection<string, BotCommand>;
	}
}
