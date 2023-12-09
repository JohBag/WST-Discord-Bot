import { SlashCommandBuilder } from 'discord.js';
import textToSpeech from '../modules/textToSpeech.js';
import { load } from '../modules/jsonHandler.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, EndBehaviorType } from '@discordjs/voice';
import Queue from '../modules/queue.js';
import pkg from '@discordjs/opus';
const { OpusEncoder } = pkg;
import wav from 'wav';
import speechToText from '../modules/speechToText.js';
import generateResponse from '../modules/generateResponse.js';
import log from '../modules/log.js';
import getUsername from '../modules/getUsername.js';

const config = load('config');

const conversation = new Queue(config.prompts.listen.messageLimit);
const encoder = new OpusEncoder(48000, 2);

const player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, () => {
    log('Playing audio.');
});
player.on(AudioPlayerStatus.Idle, () => {
    log('Audio finished playing.');
});

let connection = null;
let channel = null;
let listeningTo = [];

export default {
    data: new SlashCommandBuilder()
        .setName('listen')
        .setDescription('Speak with the AI. Responds when mentioned if its listening to multiple users.'),
    async execute(interaction) {
        try {
            log('Joining voice channel...');

            const username = getUsername(interaction);

            // Check if user is in a voice channel
            let userChannel = interaction.member.voice.channel;
            if (!userChannel) {
                log('User not in a voice channel.');
                return interaction.reply({
                    content: 'You need to join a voice channel first!', ephemeral: true
                });
            }

            // Check if user is in the same voice channel as the bot
            if (userChannel == channel) {
                // Check if user is already being listened to
                if (listeningTo.includes(username)) {
                    log('Already listening to user.');
                    return interaction.reply({
                        content: "I'm already listening to you", ephemeral: true
                    });
                }
            } else {
                // Leave current voice channel
                channel = interaction.member.voice.channel;

                // Destroy connection if it exists
                if (connection) {
                    connection.destroy();
                    listeningTo = [];
                    conversation.clear();
                }

                // Join voice channel
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                // Prevent disconnect bug
                connection.on('stateChange', (oldState, newState) => {
                    const oldNetworking = Reflect.get(oldState, 'networking');
                    const newNetworking = Reflect.get(newState, 'networking');

                    oldNetworking?.off('stateChange', networkStateChangeHandler);
                    newNetworking?.on('stateChange', networkStateChangeHandler);
                });

                connection.subscribe(player);
            }
            listeningTo.push(username);

            // Start listening
            interaction.reply({
                content: "I'm listening", ephemeral: true
            });

            while (true) {
                await listenAndRespond(connection, interaction.member.user.id, username);
            }
        } catch (error) {
            log(error);
        }
    },
};

// Prevent disconnect bug
const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
    const newUdp = Reflect.get(newNetworkState, 'udp');
    clearInterval(newUdp?.keepAliveInterval);
}

async function listenAndRespond(connection, userID, username) {
    if (await listen(connection, userID)) {
        await respond(username);
    }
}

async function listen(connection, userID) {
    return new Promise((resolve) => {
        log('Listening...');

        let receiver = connection.receiver.subscribe(userID, { end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 } });
        let fileStream = new wav.FileWriter('./media/output.wav', {
            sampleRate: 48000,
            channels: 2,
            bitDepth: 16
        });

        receiver.on('data', (chunk) => {
            fileStream.write(encoder.decode(chunk));
        });
        receiver.on('end', async () => {
            fileStream.end();
            resolve(true);
        });
    });
};

async function play(filename) {
    log('Preparing audio...')
    const loc = `${process.cwd()}/media/`;
    let resource = createAudioResource(`${loc}${filename}.mp3`);
    player.play(resource);
}

async function respond(username) {
    log('Responding...')

    // Get speech input
    const transcription = await speechToText(
        './media/output.wav'
    );
    if (!transcription) return;

    if (listeningTo.length > 1) {
        // Check if the input is valid
        let text = transcription.toLowerCase();
        if (!config.nicknames.some(nickname => text.includes(nickname))) {
            log('Missing trigger word');
            return;
        }
    }

    // Respond
    conversation.add({ role: 'user', content: `${username}: ${transcription}` });
    log(conversation.getLast());

    let response = await generateResponse(
        config.basePrompt + " " + config.prompts.listen.prompt,
        conversation.getAll()
    );
    if (!response) {
        log('Error: No response');
        return await play('NoResponse');
    }

    conversation.add({ role: 'assistant', content: `${config.name}: ${response}` });
    log(conversation.getLast());

    await textToSpeech(response);
    await play('SyntheticSpeech');
}