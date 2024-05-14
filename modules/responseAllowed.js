import log from './log.js';
import { config, secrets } from './data.js';
import { ChatInputCommandInteraction } from 'discord.js';

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
        log(`Random reply (${reactChance}% chance)`);
        return true;
    }

    return false;
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

function isRandomResponse(reactChance) {
    if (reactChance === 0) {
        return false;
    }
    if (reactChance === 1) {
        return true;
    }

    const rng = Math.random();
    return rng > (1 - reactChance);
}