import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Guild,
	MessageActionRowComponentBuilder,
	StringSelectMenuInteraction,
	VoiceBasedChannel,
} from 'discord.js';
import path from 'path';
import log from '../../core/log.js';
import UserError from '../../core/user-error.js';
import { listTracks } from './library.js';
import type { Track } from './library.js';
import { getStatus, musicEvents, play, skip, stop, togglePause } from './player.js';
import type { MusicStatus } from './player.js';

export const panelPrefix = 'music-panel:';

// Discord limits: 25 options per menu, 5 rows per message (one is used for the buttons)
const songsPerMenu = 25;
const maxMenus = 4;
const maxOptionLength = 100;
// Interaction tokens, which are needed to edit ephemeral messages, last 15 minutes
const panelLifetimeMs = 14 * 60 * 1000;

type PanelInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

interface Panel {
	interaction: PanelInteraction;
	expiresAt: number;
}

// Open panels per guild, keyed by user, so they can be refreshed when the music changes
const panels = new Map<string, Map<string, Panel>>();

export interface PanelContent {
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

// Select menu values must be unique, and file names are unique within the folder
function trackValue(track: Track): string {
	return path.basename(track.file).slice(0, maxOptionLength);
}

export function buildPanel(status: MusicStatus | null, tracks: Track[]): PanelContent {
	const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('Music');

	if (!status?.current) {
		embed.setDescription('Nothing is playing. Press ▶️ to shuffle everything, or pick a song below.');
	} else {
		const lines = [
			`${status.paused ? '⏸ Paused' : '🎶 Now playing'}: **${status.current.name}**`,
			`In <#${status.channelId}>`,
		];
		if (status.next) {
			lines.push(`Up next: ${status.next.name}`);
		}
		embed.setDescription(lines.join('\n'));
	}

	const shown = tracks.slice(0, songsPerMenu * maxMenus);
	embed.setFooter({
		text: shown.length < tracks.length
			? `Showing the first ${shown.length} of ${tracks.length} songs`
			: `${tracks.length} songs`,
	});

	const playing = status?.current != null;
	const toggle = new ButtonBuilder()
		.setCustomId(panelPrefix + 'toggle')
		.setStyle(ButtonStyle.Primary)
		.setEmoji(playing && !status!.paused ? '⏸️' : '▶️')
		.setLabel(!playing ? 'Play' : status!.paused ? 'Resume' : 'Pause')
		.setDisabled(tracks.length === 0);
	const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		toggle,
		new ButtonBuilder().setCustomId(panelPrefix + 'skip').setStyle(ButtonStyle.Secondary).setEmoji('⏭️').setLabel('Skip').setDisabled(!playing),
		new ButtonBuilder().setCustomId(panelPrefix + 'stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️').setLabel('Stop').setDisabled(!playing),
		new ButtonBuilder().setCustomId(panelPrefix + 'refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
	);

	const menus: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	for (let i = 0; i < shown.length; i += songsPerMenu) {
		const chunk = shown.slice(i, i + songsPerMenu);
		const placeholder = shown.length > songsPerMenu
			? `Pick a song (${i + 1}-${i + chunk.length})`
			: 'Pick a song';
		const menu = new StringSelectMenuBuilder()
			.setCustomId(`${panelPrefix}song:${i / songsPerMenu}`)
			.setPlaceholder(placeholder)
			.addOptions(chunk.map(track => ({
				label: track.name.slice(0, maxOptionLength),
				value: trackValue(track),
				default: track.file === status?.current?.file,
			})));
		menus.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu));
	}

	return { embeds: [embed], components: [buttons, ...menus] };
}

function render(guildId: string): PanelContent {
	return buildPanel(getStatus(guildId), listTracks());
}

function remember(interaction: PanelInteraction): void {
	const guildId = interaction.guildId!;
	if (!panels.has(guildId)) {
		panels.set(guildId, new Map());
	}
	panels.get(guildId)!.set(interaction.user.id, { interaction, expiresAt: Date.now() + panelLifetimeMs });
}

// Shows a private panel to the user who ran /music
export async function openPanel(interaction: ChatInputCommandInteraction): Promise<PanelContent> {
	remember(interaction);
	return render(interaction.guildId!);
}

// Keeps open panels in step with the music; expired ones are dropped until their owner clicks again
musicEvents.on('change', (guildId: string) => {
	const open = panels.get(guildId);
	if (!open) {
		return;
	}
	const content = render(guildId);
	for (const [userId, panel] of open) {
		if (Date.now() > panel.expiresAt) {
			open.delete(userId);
			continue;
		}
		panel.interaction.editReply(content).catch(error => {
			log.warn(`Could not update a music panel: ${error}`);
			open.delete(userId);
		});
	}
});

async function getVoiceChannel(guild: Guild, userId: string): Promise<VoiceBasedChannel> {
	// Keep playing where the music already is, rather than following whoever clicked
	const status = getStatus(guild.id);
	if (status) {
		const current = guild.channels.cache.get(status.channelId);
		if (current?.isVoiceBased()) {
			return current;
		}
	}

	const member = await guild.members.fetch(userId);
	if (!member.voice.channel) {
		throw new UserError('Join a voice channel first.');
	}
	return member.voice.channel;
}

export async function handlePanelInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
	await interaction.deferUpdate();
	remember(interaction);

	const guild = interaction.guild!;
	const action = interaction.customId.slice(panelPrefix.length);

	try {
		if (interaction.isStringSelectMenu()) {
			const value = interaction.values[0];
			const track = listTracks().find(t => trackValue(t) === value);
			if (!track) {
				throw new UserError('That song is no longer available.');
			}
			await play(await getVoiceChannel(guild, interaction.user.id), track);
		} else if (action === 'toggle') {
			if (getStatus(guild.id)) {
				togglePause(guild.id);
			} else {
				await play(await getVoiceChannel(guild, interaction.user.id));
			}
		} else if (action === 'skip') {
			skip(guild.id);
		} else if (action === 'stop') {
			stop(guild.id);
		}
	} catch (error) {
		if (!(error instanceof UserError)) {
			log.error(`Music panel action ${action} failed: ${error}`);
		}
		const message = error instanceof UserError ? error.message : 'Something went wrong with the music.';
		await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
	}

	// Covers actions that do not change the music (refresh, errors) and resets the menu selection
	await interaction.editReply(render(guild.id));
}
