import { Configuration, OpenAIApi } from "openai";
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask a question to the AI')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        return interaction.reply(await getResponse());
    },
};

let AIname = "Bot";
var conversation = `The following is a conversation with an AI assistant called ${AIname}. ${AIname} is helpful, clever, and very friendly. \
Human: Hello, who are you? \
${AIname}: Hi! My name is ${AIname}, I am an AI created by OpenAI.`;

const configuration = new Configuration({
    apiKey: "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", // Fix later
});
const openai = new OpenAIApi(configuration);

async function getResponse(prompt) {
    const completion = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: generatePrompt(prompt),
        temperature: 0.6,
        max_tokens: 512
    });

    let response = completion.data.choices[0].text;
    conversation += response;
    console.log(conversation);
    response = response.split(":").pop(); // Remove the role identifier ("AI: ")
    return response;
}

function generatePrompt(prompt) {
    conversation += "Human: " + prompt + "\n";
    return conversation;
}