import { GoogleGenAI } from "@google/genai";
import { secrets } from "./data.js";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: secrets.geminiKey });

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
			fs.writeFileSync("./media/gemini-image.png", buffer);
			console.log("Image saved as gemini-image.png");
		}
	}
}