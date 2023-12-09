import { openai } from './openai.js';
import log from './log.js';
import { load } from './jsonHandler.js';
import getConversation from './conversationHandler.js';
import sendMessage from './complexMessage.js';

const config = load('config');

export default async function generateResponse(interaction) {
    const settings = getSettings(interaction.channel.id);
    const conversation = await getConversation(interaction, settings.messageLimit);

    // Generate response
    let response = await getCompletion(
        config.basePrompt + " " + settings.prompt,
        conversation
    );
    if (!response) {
        throw new Error('No response');
    }
    response = filterName(response);

    sendMessage(interaction, response, settings.textToSpeech);
}


async function getCompletion(systemMessage, conversation) {
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

            const response = completion.choices[0].message.content;

            log(`[${model}]: ${response}`);
            resolve(response);
        } catch (error) {
            log('Error: ' + error);
            resolve('');
        } finally {
            clearTimeout(timer);
        }
    });
}

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

function getSettings(channelID) {
    const { default: defaultSettings, [channelID]: channelSettings = {} } = config.prompts;
    return { ...defaultSettings, ...channelSettings };
}