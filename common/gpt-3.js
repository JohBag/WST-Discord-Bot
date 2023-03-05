import { Configuration, OpenAIApi } from "openai";
import { load } from '../json_manager.js';
import log from './logger.js';

const config = load('config');
const name = config.name;

const secrets = load('secrets');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default async function getAIResponse(systemMessage, conversation) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 30000);

        conversation.unshift({ role: "system", content: systemMessage })
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: conversation,
        });

        if (!completion.status == 200) { // 200 = OK
            log("Error: " + completion.status);
            resolve("");
        }

        let response = completion.data.choices[0].message.content;
        console.log("Response: " + response);
        response = response.replace(name + ": ", '');

        clearTimeout(timer);
        resolve(response);
    });
}