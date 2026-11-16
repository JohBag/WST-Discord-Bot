import { ChatInputCommandInteraction, Collection, UserContextMenuCommandInteraction } from 'discord.js';
import type { ContextMenuCommandBuilder, InteractionEditReplyOptions, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Config {
	name: string;
	nicknames: string[];
	models: {
		// A claude-* or gemini-* model
		text: string;
		image: string;
	};
	chat: {
		// Lets the model look up current information on the web, at a small cost per search
		webSearch: boolean;
		// How much of the channel the model sees: the current conversation, which ends at a pause
		// longer than gapMinutes, but at least minMessages and at most maxMessages, and never
		// anything older than maxAgeDays or before a message that is exactly resetMarker
		history: {
			minMessages: number;
			maxMessages: number;
			gapMinutes: number;
			maxAgeDays: number;
			resetMarker: string;
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
		// Multiplier applied to every song after they are evened out to the same loudness; below 1 keeps it in the background.
		// The default until someone picks a level in the panel's volume menu, which is saved per guild.
		volume: number;
	};
	roles: {
		// Who may promote members
		officer: string;
		// The guild ranks, lowest first (Visitor, Probationer, Member). New members get the first,
		// and promoting moves someone one step up, replacing their old rank
		ranks: string[];
	};
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
	// Raid and event sign-ups (docs/events.md)
	events: {
		// The guild's retail realm, filled in for new characters and left off their names. WoW
		// Forever has no realms
		realm: string;
		// The channel each game's events are posted in. Without one, the post goes where /event was used
		channels?: Partial<Record<'retail' | 'forever', string>>;
		// How long a raid and an event last, for the entry in the server's Events tab
		durationMinutes: Record<'raid' | 'event', number>;
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

// Slash commands, and right-click commands on a member
export type BotCommandInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction;

export interface BotCommand<I extends BotCommandInteraction = ChatInputCommandInteraction> {
	data: SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | ContextMenuCommandBuilder;
	// False for a command that answers by itself, such as by opening a form, which has to be its
	// first reply. Otherwise a private reply is started before execute runs
	defer?: boolean;
	// Returning text or message content keeps it as the (private) reply; otherwise the reply is removed
	execute(interaction: I): Promise<void | string | InteractionEditReplyOptions>;
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
		commands: Collection<string, BotCommand<BotCommandInteraction>>;
	}
}
