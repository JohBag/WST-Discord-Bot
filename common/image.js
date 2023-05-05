import { Configuration, OpenAIApi } from "openai";
import { load } from '../json_manager.js';
import fs from 'fs';
import log from '../common/logger.js';

const secrets = load('secrets');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default async function generateImage(prompt) {
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
    fs.writeFileSync('image.png', buffer);
}