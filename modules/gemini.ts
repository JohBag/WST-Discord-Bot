import { secrets } from "./data.js";
import log from './log.js';
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { config } from './data.js';
import Message from './message.js';

const ai = new GoogleGenAI({ apiKey: secrets.keys.gemini });

const textModel = config.models.text;
const imageModel = config.models.image;
const functionDeclarations: any[] = [{ functionDeclarations: [] as any[] }];

export async function generateResponse(systemPrompt: string, conversation: any, allowFunctions: boolean = true): Promise<GenerateContentResponse> {
	log("Generating response");

	const parameters: any = {
		model: textModel,
		contents: conversation,
		config: {
			systemInstruction: systemPrompt,
		}
	};

	if (allowFunctions) {
		parameters.config.tools = functionDeclarations;
	}

	const response = await ai.models.generateContent(parameters);

	return response;
}

export async function generateImage(prompt: string): Promise<Message> {
	log("Generating image");

	const message = new Message();
	const response = await ai.models.generateContent({
		model: imageModel,
		contents: prompt,
	});
	for (const part of response.candidates![0].content!.parts!) {
		if (part.text) {
			message.addText(part.text);
		} else if (part.inlineData) {
			const imageData = part.inlineData.data!;
			const buffer = Buffer.from(imageData, "base64");
			fs.writeFileSync(config.media.imageFile, buffer);
			message.addFile(config.media.imageFile);
		}
	}

	return message;
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
	description: 'Posts a summary of a Warcraft Logs report. Leave out the id to use the guild\'s most recent report.',
	parameters: {
		type: Type.OBJECT,
		properties: {
			id: {
				type: Type.STRING,
				description: 'The Warcraft Logs report ID, as seen in the report URL.',
			},
		},
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
				description: 'Comma-separated list of options (max 25).',
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
