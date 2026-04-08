import { ChatInputCommandInteraction, Collection } from 'discord.js';
import type { SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface Config {
	name: string;
	nicknames: string[];
	models: {
		text: string;
		transcribe: string;
		tts: string;
		image: string;
		voice: string;
	};
	chat: {
		cutoff: string;
		ageLimitDays: number;
	};
	voiceChat: {
		voiceName: string;
		maxReconnectAttempts: number;
		defaultChannelId: string;
	};
	channelSettings: {
		default: ChannelSettings;
		[channelId: string]: Partial<ChannelSettings>;
	};
	blacklist: Record<string, string>;
	media: {
		speechFile: string;
		imageFile: string;
	};
	newUsersRoleId: string;
	guildId: string;
	logChannelId: string;
	warcraftLogsGuildId: number;
	prompt: string;
}

export interface ChannelSettings {
	messageLimit: number;
	reactChance: number;
	textToSpeech: boolean;
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
	data: SlashCommandOptionsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
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
}

export interface BotClient {
	commands: Collection<string, BotCommand>;
}
