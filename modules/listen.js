import {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	EndBehaviorType,
	StreamType
} from '@discordjs/voice';
import prism from 'prism-media';
import WebSocket from 'ws';
import { PassThrough } from 'stream';
import ffmpegPath from 'ffmpeg-static';
import 'sodium-native';
import { config, secrets } from '../modules/data.js';
import fs from 'fs';

process.env.FFMPEG_PATH = ffmpegPath;

const geminiApiKey = secrets.keys.gemini;
const model = config.models.voice;
const defaultVoiceChannelId = config.defaultVoiceChannelId;

let voiceConnection = null;
let geminiWs = null;
let isBotSpeaking = false;
let currentResponseStream = null;

let audioPlayer = createAudioPlayer();
audioPlayer.on(AudioPlayerStatus.Idle, () => {
	if (isBotSpeaking) {
		isBotSpeaking = false;
		endStream();
	}
});

const debugAudioFile = fs.createWriteStream('./debug_output.pcm');

let client;

export default async function listen(interaction) {
	let channelId = interaction === undefined ? defaultVoiceChannelId : interaction.member.voice.channelId;
	const channel = await getChannel(channelId);
	if (!channel) {
		console.error(`Invalid channel.`);
		return;
	}

	await connectToGemini();
	await joinChannel(channel);
}

async function getChannel(channelId) {
	let channel;
	let attempts = 0;
	while (!channel && attempts < 10) {
		channel = await client.channels.fetch(channelId);
		attempts++;
	}
	console.log(`Attempts: ${attempts}`);
	return channel;
}

async function connectToGemini() {
	const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;
	geminiWs = new WebSocket(url);

	geminiWs.on('open', () => {
		console.log('✅ Connected to Gemini Live API');
		const setupMessage = {
			setup: {
				model: model,
				generationConfig: {
					responseModalities: ["AUDIO"],
					speechConfig: {
						voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } }
					}
				},
				systemInstruction: {
					parts: [
						{
							text: config.prompt
						}
					]
				}
			}
		};
		geminiWs.send(JSON.stringify(setupMessage));
	});

	geminiWs.on('message', (data) => handleGeminiMessage(data));
	geminiWs.on('close', (code) => console.log(`Gemini Disconnected: ${code}`));
	geminiWs.on('error', (err) => console.error('Gemini Error:', err));
}

async function joinChannel(channel) {
	if (!channel) {
		console.error(`Invalid channel.`);
		return;
	}

	voiceConnection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: false,
		selfMute: false
	});

	voiceConnection.on('error', (error) => {
		console.warn('Connection Error:', error);
	});

	voiceConnection.subscribe(audioPlayer);
	console.log("Joined Voice Channel.");

	voiceConnection.receiver.speaking.on('start', (userId) => {
		if (userId === client.user.id) return;

		processUserAudio(userId);
	});
}

async function handleGeminiMessage(data) {
	try {
		const response = JSON.parse(data.toString());

		// 1. Handle Audio & Text
		if (response.serverContent?.modelTurn?.parts) {
			for (const part of response.serverContent.modelTurn.parts) {
				if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
					const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
					playResponse(audioBuffer);
				}
			}
		}

		if (response.serverContent?.turnComplete) {
			endStream();
		}

	} catch (e) {
		console.error("Error parsing Gemini message:", e);
	}
}

function endStream() {
	if (currentResponseStream) {
		currentResponseStream.end();
		currentResponseStream = null;
	}
}

function playResponse(pcmBuffer) {
	if (!isBotSpeaking || !currentResponseStream) {
		isBotSpeaking = true;

		if (!currentResponseStream) {
			currentResponseStream = new PassThrough();
		}

		const ffmpeg = new prism.FFmpeg({
			args: [
				'-analyzeduration', '0',
				'-loglevel', '0',
				'-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-',
				'-f', 's16le', '-ar', '48000', '-ac', '2',
			],
		});

		const resource = createAudioResource(currentResponseStream.pipe(ffmpeg), {
			inputType: StreamType.Raw
		});

		audioPlayer.play(resource);
	}

	currentResponseStream.write(pcmBuffer);
}

async function processUserAudio(userId) {
	const user = await client.users.fetch(userId).catch(() => null);
	const username = user ? user.username : "Dave";

	const opusStream = voiceConnection.receiver.subscribe(userId, {
		end: { behavior: EndBehaviorType.AfterSilence, duration: 500 }
	});

	opusStream.on('error', (error) => {
		console.warn(`Stream Error: ${error.message}`);
	});

	const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
	opusDecoder.on('error', (e) => console.warn(`Opus Decoder Error: ${e.message}`));

	const transcoder = new prism.FFmpeg({
		args: [
			'-analyzeduration', '0',
			'-loglevel', '0',
			'-f', 's16le', '-ar', '48000', '-ac', '2', '-i', '-',
			'-f', 's16le', '-ar', '16000', '-ac', '1',
		],
	});
	transcoder.on('error', (e) => console.warn(`FFmpeg Error: ${e.message}`));

	transcoder.on('data', (chunk) => {
		debugAudioFile.write(chunk);
	});

	try {
		const pcmStream = opusStream.pipe(opusDecoder).pipe(transcoder);

		pcmStream.on('data', (chunk) => {
			sendBuffer(chunk);
		});
	} catch (e) {
		console.warn("Pipeline construction failed", e);
	}
}

function sendBuffer(pcmBuffer) {
	if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

	geminiWs.send(JSON.stringify({
		realtimeInput: {
			audio: {
				mimeType: "audio/pcm",
				data: pcmBuffer.toString('base64')
			}
		}
	}));
}