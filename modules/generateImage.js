import { openai } from './openai.js';
import fs from 'fs';

export default async function generateImage(prompt) {
    try {
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: prompt,
            size: '1024x1024',
            response_format: 'b64_json',
            quality: 'hd',
            style: 'vivid'
        });
        if (!response.status == 200) { // 200 = OK
            throw new Error('Bad response: ' + response.status);
        }

        const b64_json = response.data[0].b64_json;
        await convertBase64ToImage(b64_json);
    } catch (error) {
        throw error;
    }
}

async function convertBase64ToImage(b64_json) {
    // Convert base64 to buffer
    const buffer = Buffer.from(b64_json, 'base64');

    // Create image from buffer
    fs.writeFileSync('./media/image.png', buffer);
}