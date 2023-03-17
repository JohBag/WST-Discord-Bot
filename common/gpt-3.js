import { Configuration, OpenAIApi } from "openai";
import { load } from '../json_manager.js';
import log from './logger.js';

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
        }, 60000); // 60 seconds

        conversation.unshift({ role: "system", content: systemMessage });
        let completion = "";
        try {
            completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: conversation,
            });

            let response = completion.data.choices[0].message.content;

            // Delete everything up to and including the first colon
            const colonIndex = response.indexOf(":");
            if (response.charAt(colonIndex + 1) === " ") {
                response = response.substring(colonIndex + 2).trim();
            }

            clearTimeout(timer);
            resolve(response);
        } catch (error) {
            log("Invalid response");
            clearTimeout(timer);
            resolve("");
        }
    });
}