import { openai } from './openai.js';
import log from './log.js';
import { load } from './jsonHandler.js';

const config = load('config');

function filterName(message) {
    const colonIndex = message.indexOf(':');
    if (colonIndex != -1) {
        const nicknames = config.nicknames;
        nicknames.push(config.name.toLowerCase());
        nicknames.some(name => {
            if (message.toLowerCase().startsWith(name)) {
                message = message.substring(colonIndex + 1).trim();
                return true;
            }
        });
    }

    return message;
}

export default async function generateResponse(systemMessage, conversation) {
    return new Promise(async (resolve) => {
        let timer = setTimeout(() => {
            log('Function timed out.');
            resolve('');
        }, 300000); // 5 minutes

        systemMessage += ` Current date: ${new Date()}.`;
        conversation.unshift({
            role: 'system', content: systemMessage
        });
        log(`[Prompt]: ${systemMessage}`);

        try {
            const model = 'gpt-4';
            const completion = await openai.chat.completions.create({
                model: model,
                messages: conversation,
            });

            let response = completion.choices[0].message.content;
            log(`[${model}]: ${response}`);
            response = filterName(response);

            resolve(response);
        } catch (error) {
            log('Error: ' + error);
            resolve('');
        } finally {
            clearTimeout(timer);
        }
    });
}