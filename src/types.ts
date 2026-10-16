import { ChatInputCommandInteraction, Collection } from 'discord.js';
import type { AutocompleteInteraction, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Config {
	name: string;
	nicknames: string[];
	models: {
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
}

export interface Secrets {
	discord: {
		appId: string | undefined;
		botToken: string | undefined;
	};
	keys: {
		gemini: string | undefined;
		warcraftLogs: string | undefined;
	};
}

export interface BotCommand {
	data: SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	// Returning a string keeps it as the (private) reply; otherwise the reply is removed
	execute(interaction: ChatInputCommandInteraction): Promise<void | string>;
	autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
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
