import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	entersState,
	EndBehaviorType,
	StreamType
} from '@discordjs/voice';
import prism from 'prism-media';
import WebSocket from 'ws';
import { PassThrough } from 'stream';
import ffmpegPath from 'ffmpeg-static';
import 'sodium-native';
import { config, secrets } from '../modules/data.js';

process.env.FFMPEG_PATH = ffmpegPath;

const CONFIG = {
	TOKEN: secrets.discord.token,
	GEMINI_API_KEY: secrets.keys.gemini,
	MODEL: 'models/gemini-2.0-flash-exp',
	GuildID: config.guildId,
	ChannelID: config.defaultVoiceChannelId,
};

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

let voiceConnection = null;
let audioPlayer = createAudioPlayer();
let geminiWs = null;
let isBotSpeaking = false;
let currentResponseStream = null;

async function connectToGemini() {
	const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${CONFIG.GEMINI_API_KEY}`;
	geminiWs = new WebSocket(url);

	geminiWs.on('open', () => {
		console.log('✅ Connected to Gemini Live API');
		const setupMessage = {
			setup: {
				model: CONFIG.MODEL,
				generation_config: {
					response_modalities: ["AUDIO"],
					speech_config: {
						voice_config: { prebuilt_voice_config: { voice_name: "Puck" } }
					}
				}
			}
		};
		geminiWs.send(JSON.stringify(setupMessage));
	});

	geminiWs.on('message', (data) => handleGeminiMessage(data));
	geminiWs.on('close', (code) => console.log(`Gemini Disconnected: ${code}`));
	geminiWs.on('error', (err) => console.error('Gemini Error:', err));
}

async function handleGeminiMessage(data) {
	try {
		const response = JSON.parse(data.toString());

		if (response.error) {
			console.error("Gemini API Error:", response.error);
		}

		if (response.serverContent?.modelTurn?.parts) {
			for (const part of response.serverContent.modelTurn.parts) {
				if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
					const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
					playResponse(audioBuffer);
				}
			}
		}
	} catch (e) {
		console.error("Error parsing Gemini message:", e);
	}
}

function playResponse(pcmBuffer) {
	if (!isBotSpeaking || !currentResponseStream) {
		isBotSpeaking = true;
		console.log("▶️ Bot started speaking...");

		currentResponseStream = new PassThrough();

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

audioPlayer.on(AudioPlayerStatus.Idle, () => {
	if (isBotSpeaking) {
		console.log("⏹️ Bot finished speaking.");
		isBotSpeaking = false;
		if (currentResponseStream) {
			currentResponseStream.end();
			currentResponseStream = null;
		}
	}
});

export default {
	name: 'clientReady',
	once: true,
	async execute() {
		await connectToGemini();
		await joinChannel(CONFIG.ChannelID);
	},
};

async function joinChannel(channelId) {
	const channel = await client.channels.fetch(channelId);
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
	console.log("🎧 Joined Voice Channel.");

	voiceConnection.receiver.speaking.on('start', (userId) => {
		if (userId === client.user.id || isBotSpeaking) return;
		processUserAudio(userId);
	});
}

function processUserAudio(userId) {
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

	try {
		const pcmStream = opusStream.pipe(opusDecoder).pipe(transcoder);

		pcmStream.on('data', (chunk) => {
			sendToGemini(chunk);
		});
	} catch (e) {
		console.warn("Pipeline construction failed", e);
	}
}

function sendToGemini(pcmBuffer) {
	if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

	geminiWs.send(JSON.stringify({
		realtime_input: {
			media_chunks: [{
				mime_type: "audio/pcm",
				data: pcmBuffer.toString('base64')
			}]
		}
	}));
}

client.login(CONFIG.TOKEN);