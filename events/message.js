import getAIResponse from "../common/gpt.js";
import textToSpeech from '../common/textToSpeech.js';
import { load } from '../json_manager.js';
import log from '../common/logger.js';
import generateImage from '../common/image.js';
import { EmbedBuilder } from 'discord.js';

const secrets = load('secrets');
const config = load('config');

const name = config.name;
const nicknames = config.nicknames;
const cutoff = config.cutoff;

export default {
    name: 'messageCreate',
    async execute(interaction) {
        if (interaction.author.bot) {
            return;
        }

        const channelID = interaction.channel.id;
        const settings = getSettings(channelID);
        console.log(settings);

        if (!shouldRespond(interaction, settings)) {
            return;
        }

        const context = await getContext(interaction, settings.messageLimit);
        console.log(context);
        if (context.length === 0) {
            return;
        }

        // Generate response
        let response = await getAIResponse(
            config.basePrompt + settings.prompt,
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
                if (speechFile != null) {
                    msg.files.push({
                        attachment: speechFile,
                        name: speechFile
                    });
                }
            }

            interaction.channel.send(msg);
        }
    },
};

function getSettings(channelID) {
    const { default: defaultSettings, [channelID]: channelSettings = {} } = config.channels;
    return { ...defaultSettings, ...channelSettings };
}

async function getContext(interaction, messageLimit) {
    // Get channel conversation
    const messages = await interaction.channel.messages.fetch({ limit: messageLimit });
    const arr = Array.from(messages.values());

    const cutoffIndex = arr.findIndex(message => message.content === cutoff);
    const messagesUntilCutoff = cutoffIndex !== -1 ? arr.slice(0, cutoffIndex) : arr;

    let conversation = await Promise.all(messagesUntilCutoff.map(async (message) => {
        const member = await interaction.guild.members.fetch(message.author.id);
        const username = member.nickname || message.author.username;
        const role = username == name ? "assistant" : "user";

        return { role: role, content: `${username}: ${message.content}` };
    }));

    return conversation.reverse();
}

function isInBlacklistedChannel(channelId) {
    return config.blacklist.includes(channelId);
}

function hasBotMention(mentions) {
    return mentions.users.size > 0 && mentions.users.has(secrets.clientId);
}

function hasBotNickname(content) {
    return nicknames.some(name => content.toLowerCase().includes(name));
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
        log("Responding to mention");
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
        const splitIndex = response.length <= 2000 ? response.length : findSplitIndex(response);
        chunks.push(response.substring(0, splitIndex));
        response = response.substring(splitIndex).trim();
    }

    return chunks;
}

function findSplitIndex(response) {
    const lastNewLine = response.lastIndexOf("\n", 2000);
    const lastCodeBlock = response.lastIndexOf("```", 2000);

    const splitIndex = Math.min(
        lastNewLine > -1 ? lastNewLine : 2000,
        lastCodeBlock > -1 ? lastCodeBlock : 2000
    );

    return splitIndex;
}