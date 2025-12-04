import { SlashCommandBuilder } from 'discord.js';
import { config } from '../modules/data.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, EndBehaviorType } from '@discordjs/voice';
import Queue from '../modules/queue.js';
import OpusScript from 'opusscript';
import wav from 'wav';
import tryGenerateResponse from '../modules/generate-response.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import transcribeAudio from '../modules/gemini.js';

const conversation = new Queue(config.prompts.listen.messageLimit);

var samplingRate = 48000;
var frameDuration = 20;
var channels = 2;
let bitDepth = 16;
var frameSize = samplingRate * frameDuration / 1000;

const encoder = new OpusScript(samplingRate, channels, OpusScript.Application.AUDIO);

const player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, () => {
	log('Playing audio.');
});
player.on(AudioPlayerStatus.Idle, () => {
	log('Audio finished playing.');
});

let connection = null;

join(config.defaultVoiceChannelId);
while (true) {
	await listenAndRespond(connection, interaction.member.user.id, username);
}

function leave() {
	if (connection) {
		connection.destroy();
	}
	conversation.clear();
}

async function join(channelId) {
	leave();

	const channel = await client.channels.fetch(channelId);

	connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});

	connection.subscribe(player);
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
			sampleRate: samplingRate,
			channels: channels,
			bitDepth: bitDepth
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
	const transcription = await transcribe('./media/output.wav');
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

	conversation.add({ role: 'model', content: `${config.name}: ${response}` });
	log(conversation.getLast());

	await textToSpeech(response);
	await play('SyntheticSpeech');
}