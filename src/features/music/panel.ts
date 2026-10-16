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

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

export function buildPanel(status: MusicStatus | null, playlists: Playlist[], mode: PlayMode): PanelContent {
	// The song menus show the playlist that is playing, or every song when nothing is
	const playlist = playlists.find(p => p.id === (status?.playlistId ?? allSongsId)) ?? playlists[0];
	const tracks = playlist?.tracks ?? [];
	const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('Music');

	if (!status?.current) {
		embed.setDescription('Nothing is playing. Press ▶️ to shuffle everything, or pick a playlist or song below.');
	} else {
		const lines = [
			`${status.paused ? '⏸ Paused' : '🎶 Now playing'}: **${status.current.name}**`,
			`In <#${status.channelId}>${playlists.length > 1 && playlist ? `, playing ${playlist.name}` : ''}`,
		];
		if (status.next) {
			lines.push(`Up next: ${status.next.name}`);
		}
		embed.setDescription(lines.join('\n'));
	}

	const showPlaylists = playlists.length > 1;
	const songMenus = maxRows - 1 - (showPlaylists ? 1 : 0);
	const shown = tracks.slice(0, songsPerMenu * songMenus);
	const songCount = shown.length < tracks.length
		? `Showing the first ${shown.length} of ${tracks.length} songs`
		: `${tracks.length} songs`;
	embed.setFooter({ text: showPlaylists && playlist ? `${playlist.name}: ${songCount}` : songCount });

	const playing = status?.current != null;
	const buttons = row(
		new ButtonBuilder()
			.setCustomId(panelPrefix + 'toggle')
			.setStyle(ButtonStyle.Primary)
			.setEmoji(playing && !status!.paused ? '⏸️' : '▶️')
			.setLabel(!playing ? 'Play' : status!.paused ? 'Resume' : 'Pause')
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
				default: playing && p.id === playlist?.id,
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
				value: trackId(track).slice(0, maxOptionLength),
				default: track.file === status?.current?.file,
			})))));
	}

	return { embeds: [embed], components: rows };
}

function render(guildId: string): PanelContent {
	return buildPanel(getStatus(guildId), listPlaylists(), getMode(guildId));
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

async function playSong(guild: Guild, userId: string, menuId: string, value: string): Promise<void> {
	// song:<menu>:<playlist>, where the playlist is a folder name that may contain colons
	const playlistId = menuId.split(':').slice(2).join(':');
	const playlist = listPlaylists().find(p => p.id === playlistId);
	const track = playlist?.tracks.find(t => trackId(t).slice(0, maxOptionLength) === value);
	if (!playlist || !track) {
		throw new UserError('That song is no longer available.');
	}
	await play(await getVoiceChannel(guild, userId), playlist.id, track);
}

export async function handlePanelInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
	await interaction.deferUpdate();
	remember(interaction);

	const guild = interaction.guild!;
	const action = interaction.customId.slice(panelPrefix.length);

	try {
		if (interaction.isStringSelectMenu() && action === 'playlist') {
			await play(await getVoiceChannel(guild, interaction.user.id), interaction.values[0]);
		} else if (interaction.isStringSelectMenu()) {
			await playSong(guild, interaction.user.id, action, interaction.values[0]);
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

	// Covers actions that do not change the music (refresh, errors) and resets the menu selection
	await interaction.editReply(render(guild.id));
}
