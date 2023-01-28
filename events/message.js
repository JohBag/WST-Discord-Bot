import getAIResponse from "../common/gpt-3.js";
import convertToSpeech from '../common/syntheticSpeech.js';
import emojiRegex from "emoji-regex";
import { load } from '../json_manager.js';

const secrets = load('secrets');
const config = load('config');

const username = 'Botty McBotface'
const nicknames = [
    'botty',
    'Botty',
]

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

        console.log("Reacting to:\n" + interaction.content);

        // Get channel conversation
        let conversation = "";
        await interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
            const member = interaction.guild.members.fetch(interaction.author);
            const name = member ? member.displayName : interaction.author.username;
            messages.reverse().forEach(message => conversation += name + ": " + message.content + "\n");
        });

        // React with emoji
        let reaction = await getAIResponse(`As ${username}, provide the unicode of a discord emoji suitable for the last message.\n${conversation}\n`);
        reaction = reaction.substring(reaction.indexOf(':'));
        console.log(reaction);

        // Check if emoji is valid
        const regex = emojiRegex();
        for (const match of reaction.matchAll(regex)) {
            const emoji = match[0];
            interaction.react(emoji);
            break;
        }

        // Generate response
        let response = await getAIResponse(`Using the last 10 messages provided, generate an appropriate response as ${username} to the most recent message in the conversation.\n${conversation}\n`);
        response = response.replace(username + ": ", '');
        console.log(response);

        // Convert to synthetic speech
        const file = await convertToSpeech(response);

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
    if (nicknames.some(name => interaction.content.includes(name)) || interaction.mentions.users.has(clientId)) {
        console.log("Responding to mention");
        return true;
    }

    // Random chance to appear
    const rng = Math.random();
    if (rng > (1 - config.reactChance)) {

        console.log("Random reply (" + rng + ")");
        return true;
    }

    return false;
}