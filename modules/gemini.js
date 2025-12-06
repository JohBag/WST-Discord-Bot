import { secrets } from "./data.js";
import fs from "fs";
import {
	GoogleGenAI,
	Type,
	createUserContent,
	createPartFromUri,
} from "@google/genai";
import wav from 'wav';
import { config } from './data.js';
import Message from './message.js';

const ai = new GoogleGenAI({ apiKey: secrets.keys.gemini });

let models = config.models;
const textModel = models.text;
const speechModel = models.speech;
const imageModel = models.image;
const transcribeModel = models.transcribe;
const functionDeclarations = [{ functionDeclarations: [] }];

export async function generateResponse(systemPrompt, conversation, allowFunctions = true) {
	const parameters = {
		model: textModel,
		contents: conversation,
		config: {
			systemInstruction: systemPrompt,
		}
	}

	if (allowFunctions) {
		parameters.config.tools = functionDeclarations;
	}

	const response = await ai.models.generateContent(parameters);

	return response;
}

export async function generateImage(prompt) {
	const message = new Message();
	const response = await ai.models.generateContent({
		model: imageModel,
		contents: prompt,
	});
	for (const part of response.candidates[0].content.parts) {
		if (part.text) {
			message.addText(part.text);
		} else if (part.inlineData) {
			const imageData = part.inlineData.data;
			const buffer = Buffer.from(imageData, "base64");
			fs.writeFileSync(config.imageFile, buffer);
			message.addFile(config.imageFile);
		}
	}

	return message;
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

// ----- Function declarations ----- //
const generatePictureFunction = {
	name: 'generate_picture',
	description: 'Generates a picture based on the given prompt.',
	parameters: {
		type: Type.OBJECT,
		properties: {
			prompt: {
				type: Type.STRING,
				description: 'The prompt to generate the picture.',
			},
		},
		required: ['prompt'],
	},
};
const createWarcraftLogFunction = {
	name: 'create_warcraft_log',
	description: 'Generates a Warcraft Logs report based on the given id.',
	parameters: {
		type: Type.OBJECT,
		properties: {
			id: {
				type: Type.STRING,
				description: 'The Warcraft Logs report ID.',
			},
		},
		required: ['id'],
	},
};
const createVoteFunction = {
	name: 'create_vote',
	description: 'Starts a vote based on the given title and options.',
	parameters: {
		type: Type.OBJECT,
		properties: {
			title: {
				type: Type.STRING,
				description: 'The title of the vote.',
			},
			options: {
				type: Type.STRING,
				description: 'Comma-separated list of options (max 5).',
			},
			anonymity: {
				type: Type.BOOLEAN,
				description: 'Whether to hide voter names and use a score system instead (default: false).',
			},
		},
		required: ['title', 'options'],
	},
};
functionDeclarations[0].functionDeclarations.push(generatePictureFunction, createWarcraftLogFunction, createVoteFunction);