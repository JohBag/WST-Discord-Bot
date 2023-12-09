import { openai } from './openai.js';
import log from './log.js';
import fs from 'fs';
import { load } from './jsonHandler.js';

const config = load('config');

export default async function speechToText(file) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 60000); // 60 seconds

        const resp = await openai.createTranscription(
            fs.createReadStream(file),
            'whisper-1',
            config.prompts.transcribe.prompt
        );

        clearTimeout(timer);
        resolve(resp.data.text);
    });
}