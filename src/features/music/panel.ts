import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Guild,
	MessageActionRowComponentBuilder,
	StringSelectMenuInteraction,
	VoiceBasedChannel,
} from 'discord.js';
import log from '../../core/log.js';
import UserError from '../../core/user-error.js';
import { allSongsId, listPlaylists, trackId } from './library.js';
import type { Playlist } from './library.js';
import { cycleMode, getMode, getStatus, musicEvents, play, skip, stop, togglePause } from './player.js';
import type { MusicStatus, PlayMode } from './player.js';

export const panelPrefix = 'music-panel:';

// Discord limits: 25 options per menu, 5 rows per message (one is used for the buttons)
const songsPerMenu = 25;
const maxRows = 5;
const maxOptionLength = 100;
// Interaction tokens, which are needed to edit ephemeral messages, last 15 minutes
const panelLifetimeMs = 14 * 60 * 1000;

const modeButtons: Record<PlayMode, { emoji: string; label: string }> = {
	continue: { emoji: '🔁', label: 'Play all' },
	repeat: { emoji: '🔂', label: 'Repeat song' },
	once: { emoji: '1️⃣', label: 'Play once' },
};

type PanelInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

// A playlist or song picked on a panel, which starts when its owner presses Play
export interface Selection {
	playlistId: string;
	trackId?: string;
}

interface Panel {
	interaction: PanelInteraction;
	expiresAt: number;
	selection?: Selection;
}

// Open panels per guild, keyed by user, so they can be refreshed when the music changes
const panels = new Map<string, Map<string, Panel>>();

export interface PanelContent {
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

// Whether pressing Play would start something other than what is playing
export function isPending(status: MusicStatus | null, selection?: Selection): boolean {
	if (!selection) {
		return false;
	}
	return !status?.current
		|| selection.playlistId !== status.playlistId
		|| (selection.trackId !== undefined && selection.trackId !== optionValue(trackId(status.current)));
}

function optionValue(text: string): string {
	return text.slice(0, maxOptionLength);
}

export function buildPanel(status: MusicStatus | null, playlists: Playlist[], mode: PlayMode, selection?: Selection): PanelContent {
	// The menus show the selection, else the playlist that is playing, else every song
	const playlist = playlists.find(p => p.id === (selection?.playlistId ?? status?.playlistId ?? allSongsId)) ?? playlists[0];
	const playingPlaylist = playlists.find(p => p.id === status?.playlistId);
	const tracks = playlist?.tracks ?? [];
	const selectedTrack = selection?.trackId ? tracks.find(t => optionValue(trackId(t)) === selection.trackId) : undefined;
	const pending = isPending(status, selection);
	const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('Music');

	const lines: string[] = [];
	if (!status?.current) {
		lines.push(pending ? 'Nothing is playing.' : 'Nothing is playing. Press ▶️ to shuffle everything, or pick a playlist or song below.');
	} else {
		lines.push(
			`${status.paused ? '⏸ Paused' : '🎶 Now playing'}: **${status.current.name}**`,
			`In <#${status.channelId}>${playlists.length > 1 && playingPlaylist ? `, playing ${playingPlaylist.name}` : ''}`,
		);
		if (status.next) {
			lines.push(`Up next: ${status.next.name}`);
		}
	}
	if (pending) {
		const picked = selectedTrack
			? `**${selectedTrack.name}**${playlists.length > 1 ? ` from ${playlist.name}` : ''}`
			: `**${playlist.name}**`;
		lines.push('', `Selected: ${picked}. Press ▶️ Play to start it, or 🔄 to go back.`);
	}
	embed.setDescription(lines.join('\n'));

	const showPlaylists = playlists.length > 1;
	const songMenus = maxRows - 1 - (showPlaylists ? 1 : 0);
	const shown = tracks.slice(0, songsPerMenu * songMenus);
	const songCount = shown.length < tracks.length
		? `Showing the first ${shown.length} of ${tracks.length} songs`
		: `${tracks.length} songs`;
	embed.setFooter({ text: showPlaylists && playlist ? `${playlist.name}: ${songCount}` : songCount });

	const playing = status?.current != null;
	const pausable = playing && !pending;
	const buttons = row(
		new ButtonBuilder()
			.setCustomId(panelPrefix + 'toggle')
			.setStyle(ButtonStyle.Primary)
			.setEmoji(pausable && !status!.paused ? '⏸️' : '▶️')
			.setLabel(!pausable ? 'Play' : status!.paused ? 'Resume' : 'Pause')
			.setDisabled(tracks.length === 0),
		new ButtonBuilder().setCustomId(panelPrefix + 'skip').setStyle(ButtonStyle.Secondary).setEmoji('⏭️').setLabel('Skip').setDisabled(!playing),
		new ButtonBuilder().setCustomId(panelPrefix + 'stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️').setLabel('Stop').setDisabled(!playing),
		new ButtonBuilder().setCustomId(panelPrefix + 'mode').setStyle(ButtonStyle.Secondary).setEmoji(modeButtons[mode].emoji).setLabel(modeButtons[mode].label),
		new ButtonBuilder().setCustomId(panelPrefix + 'refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
	);

	const rows = [buttons];
	if (showPlaylists) {
		rows.push(row(new StringSelectMenuBuilder()
			.setCustomId(panelPrefix + 'playlist')
			.setPlaceholder('Pick a playlist')
			.addOptions(playlists.slice(0, songsPerMenu).map(p => ({
				label: p.name.slice(0, maxOptionLength),
				description: `${p.tracks.length} songs`,
				value: p.id,
				default: (playing || selection !== undefined) && p.id === playlist?.id,
			})))));
	}

	for (let i = 0; i < shown.length; i += songsPerMenu) {
		const chunk = shown.slice(i, i + songsPerMenu);
		const placeholder = shown.length > songsPerMenu
			? `Pick a song (${i + 1}-${i + chunk.length})`
			: 'Pick a song';
		// The playlist is part of the ID, so a song picked from an outdated panel plays in the right playlist
		rows.push(row(new StringSelectMenuBuilder()
			.setCustomId(`${panelPrefix}song:${i / songsPerMenu}:${playlist!.id}`)
			.setPlaceholder(placeholder)
			.addOptions(chunk.map(track => ({
				label: track.name.slice(0, maxOptionLength),
				value: optionValue(trackId(track)),
				default: track.file === (selectedTrack ?? (playlist.id === status?.playlistId ? status.current : undefined))?.file,
			})))));
	}

	return { embeds: [embed], components: rows };
}

function render(guildId: string, selection?: Selection): PanelContent {
	return buildPanel(getStatus(guildId), listPlaylists(), getMode(guildId), selection);
}

// Keeps the panel's latest interaction, whose token is what allows editing it, and its selection
function remember(interaction: PanelInteraction, fresh = false): Panel {
	const guildId = interaction.guildId!;
	if (!panels.has(guildId)) {
		panels.set(guildId, new Map());
	}
	const open = panels.get(guildId)!;
	const panel: Panel = {
		interaction,
		expiresAt: Date.now() + panelLifetimeMs,
		selection: fresh ? undefined : open.get(interaction.user.id)?.selection,
	};
	open.set(interaction.user.id, panel);
	return panel;
}

// Shows a private panel to the user who ran /music
export async function openPanel(interaction: ChatInputCommandInteraction): Promise<PanelContent> {
	remember(interaction, true);
	return render(interaction.guildId!);
}

// Keeps open panels in step with the music; expired ones are dropped until their owner clicks again
musicEvents.on('change', (guildId: string) => {
	const open = panels.get(guildId);
	if (!open) {
		return;
	}
	for (const [userId, panel] of open) {
		if (Date.now() > panel.expiresAt) {
			open.delete(userId);
			continue;
		}
		panel.interaction.editReply(render(guildId, panel.selection)).catch(error => {
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

async function playSelection(guild: Guild, userId: string, selection: Selection): Promise<void> {
	const playlist = listPlaylists().find(p => p.id === selection.playlistId);
	const track = selection.trackId ? playlist?.tracks.find(t => optionValue(trackId(t)) === selection.trackId) : undefined;
	if (!playlist || (selection.trackId && !track)) {
		throw new UserError('That song is no longer available.');
	}
	await play(await getVoiceChannel(guild, userId), playlist.id, track);
}

export async function handlePanelInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
	await interaction.deferUpdate();
	const panel = remember(interaction);

	const guild = interaction.guild!;
	const action = interaction.customId.slice(panelPrefix.length);

	try {
		// Picking only selects; Play starts it
		if (interaction.isStringSelectMenu() && action === 'playlist') {
			panel.selection = { playlistId: interaction.values[0] };
		} else if (interaction.isStringSelectMenu()) {
			// song:<menu>:<playlist>, where the playlist is a folder name that may contain colons
			panel.selection = { playlistId: action.split(':').slice(2).join(':'), trackId: interaction.values[0] };
		} else if (action === 'toggle') {
			if (isPending(getStatus(guild.id), panel.selection)) {
				await playSelection(guild, interaction.user.id, panel.selection!);
				panel.selection = undefined;
			} else if (getStatus(guild.id)) {
				togglePause(guild.id);
			} else {
				await play(await getVoiceChannel(guild, interaction.user.id));
			}
		} else if (action === 'refresh') {
			panel.selection = undefined;
		} else if (action === 'skip') {
			skip(guild.id);
		} else if (action === 'stop') {
			stop(guild.id);
		} else if (action === 'mode') {
			cycleMode(guild.id);
		}
	} catch (error) {
		if (!(error instanceof UserError)) {
			log.error(`Music panel action ${action} failed: ${error}`);
		}
		const message = error instanceof UserError ? error.message : 'Something went wrong with the music.';
		await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
	}

	// Covers actions that do not change the music (selecting, refresh, errors)
	await interaction.editReply(render(guild.id, panel.selection));
}
