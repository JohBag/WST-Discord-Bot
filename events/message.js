import getAIResponse from "../common/gpt-3.js";
import convertToSpeech from '../common/syntheticSpeech.js';
import emojiRegex from "emoji-regex";
import { load } from '../json_manager.js';

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
        if (!shouldRespond(interaction, config.clientId)) {
            return;
        }

        console.log("Reacting to:\n" + interaction.content);

        // Get channel conversation
        let conversation = "";
        await interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
            const name = interaction.member.nickname ?? interaction.user.username;
            messages.reverse().forEach(message => conversation += name + ": " + message.content + "\n");
        });

        // React with emoji
        let reaction = await getAIResponse("Respond with the unicode of the discord emote you would use to react to the last message in the following conversation. \n" + conversation + " END_OF_PROMPT");
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
        let response = await getAIResponse("You are the user '" + username + "'. Respond with the reply you would send to the last message in the following conversation.\n" + conversation + " END_OF_PROMPT");
        response = response.replace("Warseeker Test Bot: ", '');
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
    if (!config.reactChannels.includes(interaction.channelId)) {
        return false;
    }

    const rng = Math.random();
    if (rng > 0.9) {
        console.log("Random reply (" + rng + ")");
        return true;
    }
    if (nicknames.some(name => interaction.content.includes(name)) || interaction.mentions.users.has(clientId)) {
        console.log("Responding to mention");
        return true;
    }

    return false;
}