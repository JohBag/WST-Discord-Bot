import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import {
	AudioPlayerStatus,
	NoSubscriberBehavior,
	StreamType,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} from '@discordjs/voice';
import type { AudioPlayer, AudioResource, VoiceConnection } from '@discordjs/voice';
import { EventEmitter } from 'events';
import type { VoiceBasedChannel } from 'discord.js';
import log from '../../core/log.js';
import UserError from '../../core/user-error.js';
import { ffmpegPath, hasFfmpeg } from './ffmpeg.js';
import { allSongsId, findPlaylist, shuffle } from './library.js';
import type { Track } from './library.js';
import { measure, volumeFilter } from './loudness.js';
import { getVolume, setVolume, stepVolume, volumeLabel } from './volume.js';

// What happens when a song ends: carry on with the playlist, play the song again, or stop
export type PlayMode = 'continue' | 'repeat' | 'once';
export const playModes: PlayMode[] = ['continue', 'repeat', 'once'];

interface Session {
	guildId: string;
	channelId: string;
	connection: VoiceConnection;
	player: AudioPlayer;
	playlistId: string;
	queue: Track[];
	current: Track | null;
	// Set by skip, so the next song plays even when repeating
	skipping: boolean;
	ffmpeg: ChildProcess | null;
	resource: AudioResource | null;
	startedAt: number;
	// Where in the song the current ffmpeg started, in milliseconds, after a volume change
	offsetMs: number;
	// Set when the volume changes while paused, so the song picks up the new volume when it resumes
	restartOnResume: boolean;
	// Tracks that ended almost immediately in a row, to stop instead of spinning on broken files
	quickFailures: number;
}

const sessions = new Map<string, Session>();
// Kept per guild between sessions, so it can be set before playing
const modes = new Map<string, PlayMode>();
const maxQuickFailures = 3;

export interface MusicStatus {
	channelId: string;
	playlistId: string;
	current: Track | null;
	next: Track | null;
	paused: boolean;
}

// Emits 'change' with the guild ID whenever what is playing, or whether it is paused, changes
export const musicEvents = new EventEmitter();

export function getStatus(guildId: string): MusicStatus | null {
	const session = sessions.get(guildId);
	if (!session) {
		return null;
	}
	const mode = getMode(guildId);
	return {
		channelId: session.channelId,
		playlistId: session.playlistId,
		current: session.current,
		next: mode === 'repeat' ? session.current : mode === 'once' ? null : session.queue[0] ?? null,
		paused: session.player.state.status === AudioPlayerStatus.Paused,
	};
}

export function getMode(guildId: string): PlayMode {
	return modes.get(guildId) ?? 'continue';
}

// Switches to the next mode and returns it
export function cycleMode(guildId: string): PlayMode {
	const mode = playModes[(playModes.indexOf(getMode(guildId)) + 1) % playModes.length];
	modes.set(guildId, mode);
	musicEvents.emit('change', guildId);
	return mode;
}

// Returns whether the music is paused afterwards
export function togglePause(guildId: string): boolean {
	const session = getSession(guildId);
	let paused: boolean;
	if (session.player.state.status !== AudioPlayerStatus.Paused) {
		paused = session.player.pause();
	} else if (session.restartOnResume) {
		restartCurrent(session);
		paused = false;
	} else {
		paused = !session.player.unpause();
	}
	musicEvents.emit('change', guildId);
	return paused;
}

// Joins the channel (or moves there) and starts playing the playlist. With a track, it plays first and
// the rest of the playlist follows in random order; without one, the whole playlist is shuffled.
export async function play(channel: VoiceBasedChannel, playlistId: string = allSongsId, track?: Track): Promise<Track> {
	const tracks = findPlaylist(playlistId)?.tracks ?? [];
	if (tracks.length === 0) {
		throw new UserError('There is no music to play yet.');
	}
	if (!hasFfmpeg()) {
		log.error('ffmpeg is not installed, so music cannot be played');
		throw new UserError('Music is not set up on this server yet.');
	}

	let session = sessions.get(channel.guild.id);
	if (!session || session.channelId !== channel.id) {
		session = await connect(channel, session);
	}

	session.playlistId = playlistId;
	session.queue = shuffle(track ? tracks.filter(t => t.file !== track.file) : tracks);
	if (track) {
		session.queue.unshift(track);
	}
	session.quickFailures = 0;
	playNext(session);
	// The song that just started is measured last, so the next ones are ready in time
	measure([...session.queue, session.current!].map(t => t.file));

	return session.current!;
}

// Moves the volume one step and returns it. A playing song restarts from the same spot at the new volume,
// since ffmpeg sets the volume and can't change it once it is running.
export function changeVolume(guildId: string, direction: 'quieter' | 'louder'): number {
	const volume = stepVolume(getVolume(guildId), direction);
	if (volume === null) {
		return getVolume(guildId);
	}
	setVolume(guildId, volume);
	log(`Music volume set to ${volumeLabel(volume)}`);

	const session = sessions.get(guildId);
	if (session?.current) {
		if (session.player.state.status === AudioPlayerStatus.Paused) {
			session.restartOnResume = true;
		} else {
			restartCurrent(session);
		}
	}
	musicEvents.emit('change', guildId);
	return volume;
}

function restartCurrent(session: Session): void {
	const position = session.offsetMs + (session.resource?.playbackDuration ?? 0);
	playTrack(session, session.current!, position);
}

export function skip(guildId: string): Track {
	const session = getSession(guildId);
	const skipped = session.current!;
	// Stopping the current track makes the player go idle, which starts the next one
	session.quickFailures = 0;
	session.skipping = true;
	session.player.stop(true);
	return skipped;
}

export function stop(guildId: string): void {
	const session = getSession(guildId);
	end(session);
}

function getSession(guildId: string): Session {
	const session = sessions.get(guildId);
	if (!session) {
		throw new UserError('Nothing is playing.');
	}
	return session;
}

async function connect(channel: VoiceBasedChannel, existing?: Session): Promise<Session> {
	// Joining again in the same guild moves the existing connection to the new channel
	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: true,
	});

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
	} catch (error) {
		log.error(`Could not join voice channel ${channel.name}: ${error}`);
		if (existing) {
			end(existing);
		} else {
			connection.destroy();
		}
		throw new UserError(`I couldn't join ${channel.name}.`);
	}

	if (existing) {
		existing.channelId = channel.id;
		return existing;
	}

	const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
	connection.subscribe(player);

	const session: Session = {
		guildId: channel.guild.id,
		channelId: channel.id,
		connection,
		player,
		playlistId: allSongsId,
		queue: [],
		current: null,
		skipping: false,
		ffmpeg: null,
		resource: null,
		startedAt: 0,
		offsetMs: 0,
		restartOnResume: false,
		quickFailures: 0,
	};
	sessions.set(session.guildId, session);

	player.on(AudioPlayerStatus.Idle, () => {
		if (sessions.get(session.guildId) !== session) {
			return;
		}
		session.quickFailures = Date.now() - session.startedAt < 2000 ? session.quickFailures + 1 : 0;
		if (session.quickFailures >= maxQuickFailures) {
			log.error('Several songs in a row failed to play, stopping the music');
			end(session);
			return;
		}

		const skipped = session.skipping;
		session.skipping = false;
		const mode = getMode(session.guildId);
		if (mode === 'repeat' && session.current && !skipped) {
			playTrack(session, session.current);
		} else if (mode === 'once' && !skipped) {
			end(session);
		} else {
			playNext(session);
		}
	});
	player.on('error', error => log.error(`Music player error on ${session.current?.name}: ${error.message}`));

	// Recommended handling from @discordjs/voice: a move between channels reconnects by itself,
	// anything else (kicked, channel deleted) ends the session
	connection.on(VoiceConnectionStatus.Disconnected, async () => {
		try {
			await Promise.race([
				entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
				entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
			]);
		} catch {
			log('Disconnected from voice, stopping the music');
			end(session);
		}
	});

	log(`Joined voice channel ${channel.name}`);
	return session;
}

function playNext(session: Session): void {
	if (session.queue.length === 0) {
		// Re-read the folder so songs added since the last round are included
		session.queue = shuffle(findPlaylist(session.playlistId)?.tracks ?? []);
		measure(session.queue.map(t => t.file));
	}
	const track = session.queue.shift();
	if (!track) {
		end(session);
		return;
	}
	playTrack(session, track);
}

// Starts the song from its beginning, or from startMs into it after a volume change
function playTrack(session: Session, track: Track, startMs = 0): void {
	session.ffmpeg?.kill();
	const ffmpeg = spawn(ffmpegPath, [
		'-loglevel', 'error',
		...(startMs > 0 ? ['-ss', (startMs / 1000).toFixed(3)] : []),
		'-i', track.file,
		'-vn',
		'-af', volumeFilter(track.file, getVolume(session.guildId)),
		'-c:a', 'libopus',
		'-b:a', '96k',
		'-f', 'ogg',
		'pipe:1',
	], { stdio: ['ignore', 'pipe', 'pipe'] });
	ffmpeg.stderr.on('data', data => log.warn(`ffmpeg (${track.name}): ${String(data).trim()}`));
	ffmpeg.on('error', error => log.error(`Could not run ffmpeg: ${error.message}`));

	session.ffmpeg = ffmpeg;
	session.current = track;
	session.startedAt = Date.now();
	session.offsetMs = startMs;
	session.restartOnResume = false;
	session.resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
	session.player.play(session.resource);
	if (startMs === 0) {
		log(`Now playing: ${track.name}`);
	}
	musicEvents.emit('change', session.guildId);
}

function end(session: Session): void {
	sessions.delete(session.guildId);
	session.ffmpeg?.kill();
	session.player.stop(true);
	if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
		session.connection.destroy();
	}
	log('Stopped the music and left voice');
	musicEvents.emit('change', session.guildId);
}
