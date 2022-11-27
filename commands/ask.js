import { Configuration, OpenAIApi } from "openai";
import { SlashCommandBuilder } from 'discord.js';
import { load } from '../json_manager.js';
import sdk from "microsoft-cognitiveservices-speech-sdk";
import readline from "readline";

const config = load('config');

export default {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask a question to the AI')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        // Get AI response
        const prompt = interaction.options.getString('input');
        let response = await getResponse(prompt);
        console.log("Response: " + response);

        // Convert to synthetic speech
        response = response.replace(/(\r\n|\n|\r)/gm, ""); // Remove line breaks
        response = response.substring(response.indexOf(': ') + 1); // Remove the role identifier ("AI: ")
        const file = await getSpeech(response);

        // Reply to user
        const msg = `*${prompt}*\n\nAI: ${response}\n`;
        console.log(conversation);

        return interaction.editReply({
            content: msg,
            files: [{
                attachment: file,
                name: file
            }]
        });
    },
};

var conversation = `The following is a conversation with an AI assistant who is helpful, clever, and very friendly. \n
Human: Hello, who are you? \n
AI: Hi! I am an AI assistant, how may I help you?\n`;

const configuration = new Configuration({
    apiKey: "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", // Fix later
});
const openai = new OpenAIApi(configuration);

async function getResponse(prompt) {
    const completion = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: getPrompt(prompt),
        temperature: 0.6,
        max_tokens: 128
    });

    let response = completion.data.choices[0].text;
    conversation += response;
    return response;
}

function getPrompt(prompt) {
    conversation += "Human: " + prompt + "\n";
    return conversation;
}

async function getSpeech(text) {
    var audioFile = "SyntheticSpeech.wav";
    // This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
    console.log(config.speechKey)
    console.log(config.speechRegion)
    const speechConfig = sdk.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);

    // The language of the voice that speaks.
    speechConfig.speechSynthesisVoiceName = "en-GB-RyanNeural"; // Male
    //speechConfig.speechSynthesisVoiceName = "en-US-SaraNeural"; // Female

    // Create the speech synthesizer.
    var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Start the synthesizer and wait for a result.
    let promise = new Promise((resolve) => {
        console.log("Synthesizing: " + text);
        synthesizer.speakTextAsync(text,
            function (result) {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    console.log("Synthesis finished.");
                } else {
                    console.error("Speech synthesis canceled, " + result.errorDetails +
                        "\nDid you set the speech resource key and region values?");
                }
                synthesizer.close();
                synthesizer = null;
                resolve();
            },
            function (err) {
                console.trace("err - " + err);
                synthesizer.close();
                synthesizer = null;
                resolve();
            });
    });
    await promise;
    return audioFile;
}