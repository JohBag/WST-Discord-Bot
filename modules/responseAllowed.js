import log from './log.js';
import { load } from './jsonHandler.js';
import { ChatInputCommandInteraction } from 'discord.js';

const config = load('config');
const secrets = load('secrets');

function isInBlacklistedChannel(channelId) {
    return channelId in config.blacklist;
}

function hasBotMention(mentions) {
    return mentions.users.size > 0 && mentions.users.has(secrets.clientId);
}

function hasBotNickname(content) {
    return config.nicknames.some(name => content.toLowerCase().includes(name));
}

function isRandomResponse(reactChance) {
    const rng = Math.random();
    return rng > (1 - reactChance);
}

export default function getResponseAllowed(interaction, reactChance) {
    if (interaction instanceof ChatInputCommandInteraction) {
        return true;
    }

    if (interaction.author.bot) {
        return false;
    }

    if (isInBlacklistedChannel(interaction.channelId)) {
        return false;
    }

    if (hasBotMention(interaction.mentions) || hasBotNickname(interaction.content)) {
        log('Responding to mention');
        return true;
    }

    if (isRandomResponse(reactChance)) {
        log(`Random reply (${Math.random()})`);
        return true;
    }

    return false;
}