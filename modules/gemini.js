import { secrets } from "./data.js";
import fs from "fs";
import {
	GoogleGenAI,
	createUserContent,
	createPartFromUri,
} from "@google/genai";
import wav from 'wav';

const ai = new GoogleGenAI({ apiKey: secrets.keys.gemini });

export async function generateResponse(systemPrompt, conversation) {
	console.log(systemPrompt);
	console.log(conversation);

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
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
		model: "gemini-2.5-flash-image",
		contents: prompt,
	});
	for (const part of response.candidates[0].content.parts) {
		if (part.text) {
			console.log(part.text);
		} else if (part.inlineData) {
			const imageData = part.inlineData.data;
			const buffer = Buffer.from(imageData, "base64");
			fs.writeFileSync("./media/image.png", buffer);
			console.log("Image saved as image.png");
		}
	}
}

export async function transcribeAudio(filename) {
	const myfile = await ai.files.upload({
		file: filename,
		config: { mimeType: "audio/mp3" },
	});

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
		contents: createUserContent([
			createPartFromUri(myfile.uri, myfile.mimeType),
			"Transcribe this audio clip",
		]),
	});
	return response.text;
}

export async function generateSpeech(text) {
	const response = await ai.models.generateContent({
		model: "gemini-2.5-pro-preview-tts",
		contents: [{ parts: [{ text: text }] }],
		config: {
			responseModalities: ['AUDIO'],
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: { voiceName: 'Kore' },
				},
			}
		}
	});

	const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
	const audioBuffer = Buffer.from(data, 'base64');

	const fileName = './media/speech.wav';
	await saveWaveFile(fileName, audioBuffer);
}

async function saveWaveFile(
	filename,
	pcmData,
	channels = 1,
	rate = 24000,
	sampleWidth = 2,
) {
	return new Promise((resolve, reject) => {
		const writer = new wav.FileWriter(filename, {
			channels,
			sampleRate: rate,
			bitDepth: sampleWidth * 8,
		});

		writer.on('finish', resolve);
		writer.on('error', reject);

		writer.write(pcmData);
		writer.end();
	});
}