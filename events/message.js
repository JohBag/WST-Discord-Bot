import getAIResponse from "../common/gpt-3.js";
import textToSpeech from '../common/syntheticSpeech.js';
import emojiRegex from "emoji-regex";
import { load } from '../json_manager.js';
import log from '../common/logger.js';

const secrets = load('secrets');
const config = load('config');

const name = config.name;
const nicknames = config.nicknames;

export default {
    name: 'messageCreate',
    async execute(interaction) {
        if (interaction.author.bot) {
            return;
        }

        // Random chance to respond
        if (!shouldRespond(interaction, secrets.clientId)) {
            return;
        }

        // Get channel conversation
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        let conversation = await Promise.all(messages.map(async (message) => {
            const member = await interaction.guild.members.fetch(message.author.id);
            const username = member.nickname || message.author.username;
            const role = username == name ? "assistant" : "user";
            return { role: role, content: `${username}: ${message.content}` };
        }));
        conversation = conversation.reverse();
        console.log(conversation);

        /*
        // React with emoji
        let reaction = await getAIResponse(`As ${name}, provide the unicode of a discord emoji suitable for the last message.`, conversation);
        reaction = reaction.substring(reaction.indexOf(':'));

        // React if emoji is valid
        const regex = emojiRegex();
        for (const match of reaction.matchAll(regex)) {
            const emoji = match[0];
            interaction.react(emoji);
            break;
        }
        */

        // Generate response
        let response = await getAIResponse(`You are ${name}, a fun and friendly AI who loves to talk to people and engage in conversation. You speak in a casual and friendly tone, as if to a friend.`, conversation);
        if (!response) {
            return;
        }

        // Convert to synthetic speech
        const file = await textToSpeech(response);

        // Prepare message
        let msg = { content: response };
        if (file != null) {
            msg['files'] = [{
                attachment: file,
                name: file
            }];
        }

        // Send
        interaction.channel.send(msg);
    },
};

function shouldRespond(interaction, clientId) {
    // Check if bot is allowed in channel
    const whitelist = config.reactWhitelist;
    if (whitelist.length > 0 && !whitelist.includes(interaction.channelId)) {
        return false;
    } else {
        const blacklist = config.reactBlacklist;
        if (blacklist.includes(interaction.channelId)) {
            return false;
        }
    }

    // Check if bot is mentioned
    if (nicknames.some(name => interaction.content.toLowerCase().includes(name)) || interaction.mentions.users.has(clientId)) {
        log("Responding to mention");
        return true;
    }

    // Random chance to appear
    const rng = Math.random();
    if (rng > (1 - config.reactChance)) {
        log("Random reply (" + rng + ")");
        return true;
    }

    return false;
}