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
import { config, secrets } from '../modules/data.js';
import { PassThrough } from 'stream';

export default {
	name: 'clientReady',
	once: true,
	async execute() {
		await connectToGemini(); // Initialize the Gemini Connection
		await joinChannel(CONFIG.ChannelID);
	},
};

// --- CONFIGURATION ---
const CONFIG = {
	TOKEN: secrets.discord.token,
	GEMINI_API_KEY: secrets.keys.gemini,
	// The Gemini Live models (e.g., gemini-2.0-flash-exp) support the WebSocket API
	MODEL: 'models/gemini-2.0-flash-exp',
	GuildID: config.guildId,
	ChannelID: config.defaultVoiceChannelId,
};

// --- DISCORD CLIENT SETUP ---
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

// Global State
let voiceConnection = null;
let audioPlayer = createAudioPlayer();
let geminiWs = null;
// We use a simple flag to prevent the bot from listening to itself or overlapping responses
let isBotSpeaking = false;

let currentResponseStream = null;

// --- GEMINI WEB SOCKET HANDLER ---
async function connectToGemini() {
	const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${CONFIG.GEMINI_API_KEY}`;

	geminiWs = new WebSocket(url);

	geminiWs.on('open', () => {
		console.log('Connected to Gemini Live API');

		// 1. Send Setup Message
		const setupMessage = {
			setup: {
				model: CONFIG.MODEL,
				generation_config: {
					response_modalities: ["AUDIO"],
					speech_config: {
						voice_config: { prebuilt_voice_config: { voice_name: "Puck" } } // Options: Puck, Charon, Kore, Fenrir, Aoede
					}
				}
			}
		};
		geminiWs.send(JSON.stringify(setupMessage));
	});

	geminiWs.on('message', (data) => {
		handleGeminiMessage(data);
	});

	geminiWs.on('close', (code, reason) => {
		console.log(`Gemini Disconnected: ${code} - ${reason}`);
		// Reconnect logic could go here
		setTimeout(connectToGemini, 5000);
	});

	geminiWs.on('error', (error) => {
		console.error('Gemini WebSocket Error:', error);
	});
}

async function handleGeminiMessage(data) {
	try {
		const response = JSON.parse(data.toString());

		// Handle Audio Response from Gemini
		if (response.serverContent && response.serverContent.modelTurn) {
			const parts = response.serverContent.modelTurn.parts;
			for (const part of parts) {
				if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
					// Gemini sends raw PCM (usually 24kHz) in base64
					const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
					playResponse(audioBuffer);
				}
			}
		}

		// Handling Turn Completion (Bot finished generating)
		if (response.serverContent && response.serverContent.turnComplete) {
			// console.log("Gemini turn complete");
		}
	} catch (e) {
		console.error("Error parsing Gemini message:", e);
	}
}

function playResponse(pcmBuffer) {
	// 1. If we aren't already speaking, start a new stream pipeline
	if (!isBotSpeaking || !currentResponseStream) {
		isBotSpeaking = true;

		// Create a stream that we can push Gemini's chunks into
		currentResponseStream = new PassThrough();

		// 2. Setup FFmpeg to resample Gemini (24kHz Mono) -> Discord (48kHz Stereo)
		// Gemini sends raw PCM, Signed 16-bit LE, 24000Hz, 1 Channel
		const ffmpeg = new prism.FFmpeg({
			args: [
				'-analyzeduration', '0',
				'-loglevel', '0',
				'-f', 's16le', // Input format
				'-ar', '24000', // Input rate (Gemini)
				'-ac', '1',    // Input channels (Gemini)
				'-i', '-',     // Input from stdin (our stream)
				'-f', 's16le', // Output format
				'-ar', '48000', // Output rate (Discord standard)
				'-ac', '2',    // Output channels (Stereo)
			],
		});

		// Pipe our push stream into FFmpeg
		const audioResource = createAudioResource(currentResponseStream.pipe(ffmpeg), {
			inputType: StreamType.Raw
		});

		audioPlayer.play(audioResource);
	}

	// 3. Push the new chunk of audio into the existing stream
	// This keeps the audio smooth without restarting the player
	currentResponseStream.write(pcmBuffer);
}

// Reset when the bot finishes talking
audioPlayer.on(AudioPlayerStatus.Idle, () => {
	isBotSpeaking = false;
	if (currentResponseStream) {
		currentResponseStream.end(); // Close the stream
		currentResponseStream = null;
	}
});

// --- AUDIO INPUT (Discord -> Gemini) ---
async function joinChannel(channelId) {
	const channel = await client.channels.fetch(channelId);
	if (!channel) return console.error("Channel not found");

	voiceConnection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: false,
		selfMute: false
	});

	voiceConnection.subscribe(audioPlayer);

	console.log("Joined Voice Channel. Listening...");

	// Listen to users
	voiceConnection.receiver.speaking.on('start', (userId) => {
		if (userId === client.user.id) return;
		if (isBotSpeaking) return; // Don't listen while talking (basic echo cancellation)

		console.log(`User ${userId} started speaking`);
		processUserAudio(userId);
	});
}

function processUserAudio(userId) {
	// 1. Subscribe to the user's audio stream (Opus)
	const opusStream = voiceConnection.receiver.subscribe(userId, {
		end: { behavior: EndBehaviorType.AfterSilence, duration: 500 }
	});

	// 2. Decode Opus to PCM (Signed 16-bit Little Endian, 48kHz, Stereo)
	// We use prism-media's opus.Decoder
	const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
	const pcmStream = opusStream.pipe(opusDecoder);

	// 3. Resample & Send to Gemini
	// Discord (48kHz Stereo) -> Gemini (16kHz Mono preferred for input)
	// We can use a simple JS buffer loop to downsample to avoid heavy FFmpeg spawning per-utterance

	pcmStream.on('data', (chunk) => {
		// chunk is Buffer (Int16LE, 48kHz, 2 channels)
		// We want to convert to (Int16LE, 16kHz, 1 channel)

		// 48000 / 16000 = 3 (Take every 3rd sample)
		const inputBuffer = chunk;
		const outputBuffer = Buffer.alloc(inputBuffer.length / 6); // 2 bytes * 2 channels * 3 ratio = divide by 6 for mono result

		let outOffset = 0;
		for (let i = 0; i < inputBuffer.length; i += 12) { // 12 bytes = 2ch * 2bytes * 3 samples
			if (outOffset >= outputBuffer.length) break;

			// Simple Downsample: Just take the left channel of the first sample in the block
			// (Averaging is better, but this is fast and works for speech)
			const val = inputBuffer.readInt16LE(i);
			outputBuffer.writeInt16LE(val, outOffset);
			outOffset += 2;
		}

		sendToGemini(outputBuffer);
	});

	pcmStream.on('end', () => {
		// console.log(`User ${userId} finished speaking`);
	});
}

function sendToGemini(pcmBuffer) {
	if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

	// Construct the RealtimeInput Message
	const msg = {
		realtime_input: {
			media_chunks: [
				{
					mime_type: "audio/pcm", // Gemini assumes 16kHz/1ch if not specified, or infers
					data: pcmBuffer.toString('base64')
				}
			]
		}
	};

	geminiWs.send(JSON.stringify(msg));
}

// Login
client.login(CONFIG.TOKEN);