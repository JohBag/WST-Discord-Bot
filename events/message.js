import getAIResponse from "../common/gpt-3.js";
import textToSpeech from '../common/textToSpeech.js';
import emojiRegex from "emoji-regex";
import { load } from '../json_manager.js';
import log from '../common/logger.js';

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

        if (config.reactChannels.includes(interaction.channelId)) {
            console.log(true);
        } else {
            // Random chance to respond
            if (!shouldRespond(interaction, secrets.clientId)) {
                return;
            }
        }

        // Get channel conversation
        const messages = await interaction.channel.messages.fetch({ limit: 20 });
        const arr = Array.from(messages.values());
        const cutoffIndex = arr.findIndex(message => message.content === cutoff);
        const messagesUntilCutoff = cutoffIndex !== -1 ? arr.slice(0, cutoffIndex) : arr;
        let conversation = await Promise.all(messagesUntilCutoff.map(async (message) => {
            const member = await interaction.guild.members.fetch(message.author.id);
            const username = member.nickname || message.author.username;
            const role = username == name ? "assistant" : "user";

            return { role: role, content: `${username}: ${message.content}` };
        }));
        if (conversation.length === 0) {
            return;
        }
        conversation = conversation.reverse();

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
        let response = await getAIResponse(`
            You're a fun and talkative adventurer named ${name}, commonly referred to as Botty. 
            You're in the World of Warcraft guild 'Warseeker Tribe' Discord server, a place for friends to hang out and chat.
            Write in a casual and emotive style and use emojis to express emotion.
            When giving information, do so in a simple or humorous way.
            Current date: ${new Date()}.`,
            conversation
        );
        if (!response) {
            return;
        }

        // Split response into pieces of 2000 characters or less (discord limit)
        const chunks = [];
        if (response.length > 2000) {
            while (response.length > 2000) {
                const lastNewLine = response.lastIndexOf("\n", 2000);
                const lastCodeBlock = response.lastIndexOf("```", 2000);
                const index = Math.min(lastNewLine === -1 ? 2000 : lastNewLine, lastCodeBlock === -1 ? 2000 : lastCodeBlock);
                if (index === -1) {
                    break;
                }
                chunks.push(response.substring(0, index));
                response = response.substring(index + 1);
            }
        }
        else {
            chunks.push(response);
        }

        // Send chunks
        for (const chunk of chunks) {
            // Convert to synthetic speech
            const file = await textToSpeech(chunk);

            // Prepare message
            let msg = { content: chunk };
            if (file != null) {
                msg['files'] = [{
                    attachment: file,
                    name: file
                }];
            }

            // Send
            interaction.channel.send(msg);
        }
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