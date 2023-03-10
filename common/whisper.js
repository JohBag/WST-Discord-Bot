import { Configuration, OpenAIApi } from "openai";
import fs from 'fs';
import { load } from '../json_manager.js';
import log from './logger.js';

const secrets = load('secrets');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default async function transcribe(file, prompt = "") {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 60000); // 60 seconds

        const resp = await openai.createTranscription(
            fs.createReadStream(file),
            "whisper-1",
            prompt
        );

        clearTimeout(timer);
        resolve(resp.data.text);
    });
}