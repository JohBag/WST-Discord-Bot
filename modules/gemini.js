import { secrets } from "./data.js";
import fs from "fs";
import {
	GoogleGenAI,
	createUserContent,
	createPartFromUri,
} from "@google/genai";
import wav from 'wav';
import { config } from './data.js';

const ai = new GoogleGenAI({ apiKey: secrets.keys.gemini });

let models = config.models;
const textModel = models.text;
const speechModel = models.speech;
const imageModel = models.image;
const transcribeModel = models.transcribe;

export async function generateResponse(systemPrompt, conversation) {
	console.log(systemPrompt);
	console.log(conversation);

	const response = await ai.models.generateContent({
		model: textModel,
		contents: conversation,
		config: {
			systemInstruction: systemPrompt,
		}
	});

	console.log(response.text);

	return response.text;
}

export async function generateImage(prompt) {
	const response = await ai.models.generateContent({
		model: imageModel,
		contents: prompt,
	});
	for (const part of response.candidates[0].content.parts) {
		if (part.text) {
			console.log(part.text);
		} else if (part.inlineData) {
			const imageData = part.inlineData.data;
			const buffer = Buffer.from(imageData, "base64");
			fs.writeFileSync(config.imageFile, buffer);
		}
	}
}

export async function transcribeAudio(filename) {
	const myfile = await ai.files.upload({
		file: filename,
		config: { mimeType: "audio/mp3" },
	});

	const response = await ai.models.generateContent({
		model: transcribeModel,
		contents: createUserContent([
			createPartFromUri(myfile.uri, myfile.mimeType),
			"Transcribe this audio clip",
		]),
	});
	return response.text;
}

export async function generateSpeech(text) {
	const response = await ai.models.generateContent({
		model: speechModel,
		contents: [{ parts: [{ text: text }] }],
		config: {
			responseModalities: ['AUDIO'],
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: { voiceName: config.voice },
				},
			}
		}
	});

	const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
	const audioBuffer = Buffer.from(data, 'base64');

	await saveWaveFile(audioBuffer);
}

async function saveWaveFile(pcmData) {
	return new Promise((resolve, reject) => {
		const writer = new wav.FileWriter(config.speechFile, {
			channels: 1,
			sampleRate: 24000,
			bitDepth: 16,
		});

		writer.on('finish', resolve);
		writer.on('error', reject);

		writer.write(pcmData);
		writer.end();
	});
}