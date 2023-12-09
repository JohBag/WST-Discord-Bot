import generateResponse from '../modules/generateResponse.js';
import textToSpeech from '../modules/textToSpeech.js';
import { load } from '../modules/jsonHandler.js';
import log from '../modules/log.js';
import { getUserName } from '../modules/getUserName.js';

const secrets = load('secrets');
const config = load('config');

const messageCharLimit = 2000;

export default {
    name: 'messageCreate',
    async execute(interaction) {
        if (interaction.author.bot) {
            return;
        }

        const channelID = interaction.channel.id;
        const settings = getSettings(channelID);

        if (!shouldRespond(interaction, settings)) {
            return;
        }

        const context = await getContext(interaction, settings.messageLimit);
        if (context.length === 0) {
            return;
        }

        // Generate response
        let response = await generateResponse(
            config.basePrompt + " " + settings.prompt,
            context
        );
        if (!response) {
            return;
        }

        // Split response into pieces of 2000 characters or less (discord limit)
        const messages = splitResponse(response);

        for (const message of messages) {
            let msg = { content: message, files: [] };

            if (settings.textToSpeech) {
                const speechFile = await textToSpeech(message);
                if (speechFile) {
                    msg.files.push({
                        attachment: speechFile,
                        name: 'SyntheticSpeech.mp3',
                    });
                }
            }

            interaction.channel.send(msg);
        }
    },
};

function getSettings(channelID) {
    const { default: defaultSettings, [channelID]: channelSettings = {} } = config.prompts;
    return { ...defaultSettings, ...channelSettings };
}

function removeAsteriskContent(message) {
    return message.replace(/\s*\*\w*\*\s*/g, ' ').trim();
}

async function getConversation(messagesUntilCutoff, interaction) {
    let conversation = await Promise.all(
        messagesUntilCutoff
            .map((message) => {
                // Remove asterisk content and trim the message
                const modifiedMessage = removeAsteriskContent(message.content);

                // Add a modifiedContent property to each message object with the new message
                message.modifiedContent = modifiedMessage;
                return message;
            })
            .filter((message) => message.modifiedContent !== '') // Filter out empty messages
            .map(async (message) => {
                const username = await getUserName(message);
                const role = username === config.name ? 'assistant' : 'user';

                return { role: role, content: `${username}: ${message.modifiedContent}` };
            })
    );

    return conversation.reverse();
}

async function getContext(interaction, messageLimit) {
    // Get channel conversation
    const messages = await interaction.channel.messages.fetch({ limit: messageLimit });
    const arr = Array.from(messages.values());

    const cutoffIndex = arr.findIndex(message => message.content === config.cutoff);
    const messagesUntilCutoff = cutoffIndex !== -1 ? arr.slice(0, cutoffIndex) : arr;

    return await getConversation(messagesUntilCutoff, interaction);
}

function isInBlacklistedChannel(channelId) {
    return channelId in config.blacklist;
}

function hasBotMention(mentions) {
    return mentions.users.size > 0 && mentions.users.has(secrets.clientId);
}

function hasBotNickname(content) {
    return config.nicknames.some(name => content.toLowerCase().includes(name));
}

function shouldReactRandomly(reactChance) {
    const rng = Math.random();
    return rng > (1 - reactChance);
}

function shouldRespond(interaction, settings) {
    const { channelId, mentions, content } = interaction;

    if (isInBlacklistedChannel(channelId)) {
        return false;
    }

    if (hasBotMention(mentions) || hasBotNickname(content)) {
        log('Responding to mention');
        return true;
    }

    if (shouldReactRandomly(settings.reactChance)) {
        log(`Random reply (${Math.random()})`);
        return true;
    }

    return false;
}

function splitResponse(response) {
    const chunks = [];

    while (response.length) {
        const splitIndex = response.length <= messageCharLimit ? response.length : findSplitIndex(response);
        chunks.push(response.substring(0, splitIndex));
        response = response.substring(splitIndex).trim();
    }

    return chunks;
}

function findSplitIndex(response) {
    const lastNewLine = response.lastIndexOf('\n', messageCharLimit);
    const lastCodeBlock = response.lastIndexOf('```', messageCharLimit);

    const splitIndex = Math.min(
        lastNewLine > -1 ? lastNewLine : messageCharLimit,
        lastCodeBlock > -1 ? lastCodeBlock : messageCharLimit
    );

    return splitIndex;
}