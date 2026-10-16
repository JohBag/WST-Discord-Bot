import { ChatInputCommandInteraction, Collection } from 'discord.js';
import type { InteractionEditReplyOptions, SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface Config {
	name: string;
	nicknames: string[];
	models: {
		// A gemini-* or claude-* model; channels can override it
		text: string;
		image: string;
	};
	chat: {
		cutoff: string;
		ageLimitDays: number;
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
	messageLimit: number;
	reactChance: number;
	// Overrides models.text in this channel, to try a model on one channel first
	model?: string;
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
