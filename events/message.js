import getAIResponse from "../common/gpt-3.js";

export default {
    name: 'messageCreate',
    async execute(interaction) {
        console.log('Message!');

        let channelID = interaction.channelId;
        messages[channelID] = messages[channelID] || [];

        let channel = messages[channelID];

        let message = {
            author: interaction.author.username,
            content: interaction.content
        }

        channel.push(message);

        if (channel.length > 20) {
            channel.shift();
        }

        if (interaction.author.bot) {
            return;
        }

        interpretMessage(channelID);
    },
};

let messages = {};

async function interpretMessage(channelID) {
    let conversation = "";

    const channel = messages[channelID];
    for (const i of channel) {
        conversation += i.author + ": " + i.content + "\n";
    }
    console.log(conversation);

    const response = await getAIResponse("What discord emote would you use to react to the last message in the following conversation?\n" + conversation);
    console.log(response);
}