import { Configuration, OpenAIApi } from "openai";
import { load } from '../json_manager.js';
import log from './logger.js';

const secrets = load('secrets');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default async function getAIResponse(prompt) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 10000);

        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            temperature: 1,
            max_tokens: 128
        });
        if (!completion.status == 200) { // 200 = OK
            log("Error: " + completion.status);
            resolve("");
        }

        clearTimeout(timer);
        resolve(completion.data.choices[0].text);
    });
}