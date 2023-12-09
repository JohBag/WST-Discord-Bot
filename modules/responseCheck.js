import log from './log.js';
import { load } from './jsonHandler.js';

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

function shouldReactRandomly(reactChance) {
    const rng = Math.random();
    return rng > (1 - reactChance);
}

export function shouldRespond(interaction, settings) {
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