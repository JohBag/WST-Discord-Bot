import { Configuration, OpenAIApi } from "openai";
import { load } from '../json_manager.js';
import log from './logger.js';

const secrets = load('secrets');
const config = load('config');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default async function getAIResponse(systemMessage, conversation, gpt4 = false) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 300000); // 5 minutes

        systemMessage += `\nCurrent date: ${new Date()}.`;

        const model = gpt4 ? "gpt-4" : "gpt-3.5-turbo";

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

            console.log(response);

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