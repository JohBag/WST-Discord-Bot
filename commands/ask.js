import { Configuration, OpenAIApi } from "openai";
import { SlashCommandBuilder } from 'discord.js';
import { load } from '../json_manager.js';
import sdk from "microsoft-cognitiveservices-speech-sdk";

const config = load('config');
const configuration = new Configuration({
    apiKey: config.apiKey,
});
const openai = new OpenAIApi(configuration);

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
        const response = await getOpenAIResponse(prompt + "\n");

        // Convert to synthetic speech
        const file = await convertToSpeech(response);

        // Reply to user
        const msg = "*" + prompt + "*\n" + response + "\n";

        return interaction.editReply({
            content: msg,
            files: [{
                attachment: file,
                name: file
            }]
        });
    },
};

async function getOpenAIResponse(prompt) {
    const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: 0.6,
        max_tokens: 128
    });

    return completion.data.choices[0].text;;
}

async function convertToSpeech(text) {
    var fileName = "SyntheticSpeech.wav";

    const speechConfig = sdk.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(fileName);

    // Voice
    speechConfig.speechSynthesisVoiceName = "en-GB-RyanNeural"; // Male
    //speechConfig.speechSynthesisVoiceName = "en-US-SaraNeural"; // Female

    // Create the speech synthesizer.
    var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    // Start the synthesizer and wait for a result.
    let promise = new Promise((resolve) => {
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

    return fileName;
}