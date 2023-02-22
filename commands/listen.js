import { SlashCommandBuilder } from 'discord.js';
import getAIResponse from "../common/gpt-3.js";
import textToSpeech from '../common/syntheticSpeech.js';
import speechToText from '../common/speechRecognition.js';
import { load } from '../json_manager.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, EndBehaviorType, VoiceConnectionStatus } from '@discordjs/voice';
import Queue from '../common/queue.js';
import pkg from '@discordjs/opus';
const { OpusEncoder } = pkg;
import wav from 'wav';
import log from '../common/logger.js';

const config = load('config');
const name = config.name;
const nicknames = config.nicknames;
const triggerWords = config.triggerWords;

const conversation = new Queue(10);
const encoder = new OpusEncoder(48000, 2);
const player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, () => {
    log('Playing audio!');
});
let connection = null;
let channel = null;
let listeningTo = [];

export default {
    data: new SlashCommandBuilder()
        .setName('listen')
        .setDescription('Listens to your voice and responds to "Botty"'),
    async execute(interaction) {
        log("Joining voice channel...");

        const username = interaction.member.displayName || interaction.author.username;

        // Check if user is in a voice channel
        let userChannel = interaction.member.voice.channel;
        if (!userChannel) {
            log("User not in a voice channel.");
            return interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
        }

        // Check if user is in the same voice channel as the bot
        if (userChannel == channel) {
            // Check if user is already being listened to
            if (listeningTo.includes(username)) {
                log("Already listening to user.");
                return interaction.reply({ content: 'I am already listening.', ephemeral: true });
            }
        } else {
            // Leave current voice channel
            channel = interaction.member.voice.channel;

            // Destroy connection if it exists
            if (connection) {
                log("Destroying connection...");
                connection.destroy();
                listeningTo = [];
            }

            // Join voice channel
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            })
            connection.subscribe(player);
        }
        listeningTo.push(username);

        // Start listening
        interaction.reply({ content: "I'm listening", ephemeral: true });
        while (true) {
            await listen(connection, interaction.member.user.id, username);
        }
    },
};

async function listen(connection, userID, username) {
    return new Promise((resolve) => {
        log("Listening...");

        let receiver = connection.receiver.subscribe(userID, { end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 } });
        let fileStream = new wav.FileWriter("./output.wav", {
            sampleRate: 48000,
            channels: 2,
            bitDepth: 16
        });

        receiver.on("data", (chunk) => {
            fileStream.write(encoder.decode(chunk));
        });
        receiver.on("end", async () => {
            fileStream.end();

            await respond(username);
            resolve();
        });
    });
};

async function respond(username) {
    // Get speech input
    const speechInput = await speechToText();
    if (!speechInput) return;

    // Check if the input is valid
    let text = speechInput.toLowerCase();
    const found = triggerWords.some(sound => {
        if (text.includes(sound)) {
            text = text.replace(sound, 'Botty');
            return true;
        }
        return false;
    });
    if (!found && !nicknames.some(nickname => text.includes(nickname))) {
        log("Invalid response.");
        return;
    }

    // Respond
    conversation.add(`${username}: ${text}\n`);

    let response = await getAIResponse(`Respond as ${name} to the last message: \n"${conversation.getAllAsString()}"\n`);
    if (!response) {
        log("Error: No response");
        return;
    }

    response = response.replace(name + ":", '').replace(/(\r\n|\n|\r)/gm, '');

    conversation.add(`${name}: ${response}\n`);
    log(`${name}: ${response}`);

    await textToSpeech(response);

    // Play response
    const loc = process.cwd() + '\/';
    let resource = createAudioResource(loc + 'SyntheticSpeech.mp3');
    player.play(resource);
}