import { SlashCommandBuilder } from 'discord.js';
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { findTrack, listTracks, searchTracks } from '../features/music/library.js';
import { play, skip, stop } from '../features/music/player.js';
import UserError from '../core/user-error.js';
import type { BotCommand } from '../types.js';

// Discord limits for autocomplete and message length
const maxChoices = 25;
const maxChoiceLength = 100;
const maxMessageLength = 2000;

export default {
	data: new SlashCommandBuilder()
		.setName('music')
		.setDescription('Play music in a voice channel')
		.addSubcommand(subcommand =>
			subcommand
				.setName('play')
				.setDescription('Join your voice channel and play music')
				.addStringOption(option =>
					option
						.setName('song')
						.setDescription('Song to start with (default: shuffle everything)')
						.setAutocomplete(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('skip')
				.setDescription('Skip to the next song'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Stop the music and leave the voice channel'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List the available songs')),

	async execute(interaction: ChatInputCommandInteraction) {
		const guild = interaction.guild!;

		switch (interaction.options.getSubcommand()) {
			case 'play': {
				const member = await guild.members.fetch(interaction.user.id);
				const channel = member.voice.channel;
				if (!channel) {
					throw new UserError('Join a voice channel first.');
				}

				const query = interaction.options.getString('song');
				const track = query ? findTrack(listTracks(), query) : undefined;
				if (query && !track) {
					throw new UserError(`I couldn't find a song called "${query}". Use /music list to see them all.`);
				}

				const playing = await play(channel, track);
				return `Now playing **${playing.name}** in ${channel}.`;
			}
			case 'skip':
				return `Skipped **${skip(guild.id).name}**.`;
			case 'stop':
				stop(guild.id);
				return 'Stopped the music.';
			case 'list': {
				const tracks = listTracks();
				if (tracks.length === 0) {
					return 'There are no songs yet.';
				}
				const list = `**${tracks.length} songs:**\n` + tracks.map(track => `- ${track.name}`).join('\n');
				return list.length > maxMessageLength ? list.slice(0, maxMessageLength - 3) + '...' : list;
			}
		}
	},

	async autocomplete(interaction: AutocompleteInteraction) {
		const query = interaction.options.getFocused();
		const choices = searchTracks(listTracks(), query)
			.slice(0, maxChoices)
			.map(track => {
				const name = track.name.slice(0, maxChoiceLength);
				return { name, value: name };
			});
		await interaction.respond(choices);
	},
} satisfies BotCommand;
