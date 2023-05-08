import { Configuration, OpenAIApi } from "openai";
import { load } from './jsonHandler.js';
import log from './logger.js';
import fs from 'fs';

const secrets = load('secrets');
const config = load('config');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export const models = {
    "GPT4": "gpt-4",
    "ChatGPT": "gpt-3.5-turbo",
}

export async function generateResponse(systemMessage, conversation, model = models.ChatGPT) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 300000); // 5 minutes

        systemMessage += `\nCurrent date: ${new Date()}.`;

        log(`[Prompt]: ${systemMessage}`);

        conversation.unshift({ role: "system", content: systemMessage });
        let completion = "";
        try {
            completion = await openai.createChatCompletion({
                model: model,
                messages: conversation,
            });

            let response = completion.data.choices[0].message.content;

            if (!response) {
                log("Invalid response");
                clearTimeout(timer);
                resolve("");
            }

            log(`[${model}]: ${response}`);

            // Check if name is mentioned
            const nicknames = config.nicknames;
            for (const name of nicknames) {
                // Check if nickname is part of response
                if (response.toLowerCase().includes(name)) {
                    // Delete everything up to and including the first colon
                    const colonIndex = response.indexOf(":");
                    if (response.charAt(colonIndex + 1) === " ") {
                        response = response.substring(colonIndex + 2).trim();
                    }
                    break;
                }
            };

            clearTimeout(timer);
            resolve(response);
        } catch (error) {
            log("Invalid response");
            clearTimeout(timer);
            resolve("");
        }
    });
}

export async function transcribe(file) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 60000); // 60 seconds

        const resp = await openai.createTranscription(
            fs.createReadStream(file),
            "whisper-1",
            config.prompts.transcribe.prompt
        );

        clearTimeout(timer);
        resolve(resp.data.text);
    });
}

export async function generateImage(prompt) {
    const response = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: 'b64_json'
    });
    if (!response.status == 200) { // 200 = OK
        log("Error: " + completion.status);
        return false;
    }
    const b64 = response.data.data[0].b64_json;

    await convertBase64ToImage(b64);
    return true;
}

async function convertBase64ToImage(data) {
    // Convert base64 to buffer
    const buffer = Buffer.from(data, "base64");

    // Create image from buffer
    fs.writeFileSync('.\\media\\image.png', buffer);
}