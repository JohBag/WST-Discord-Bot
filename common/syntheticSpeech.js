import { load } from '../json_manager.js';
import sdk from "microsoft-cognitiveservices-speech-sdk";

const config = load('config');

export default async function convertToSpeech(text, voice = 'ryan') {
    var fileName = "SyntheticSpeech.mp3";

    const speechConfig = sdk.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(fileName);

    // Voice
    let voiceID = "en-GB-RyanNeural";
    if (voice == 'sara') {
        voiceID = "en-US-SaraNeural"; // Female
    } else if (voice == 'ashley') {
        voiceID = "en-US-AshleyNeural";
    }
    speechConfig.speechSynthesisVoiceName = voiceID;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;

    // Create the speech synthesizer.
    var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    // Start the synthesizer and wait for a result.
    let promise = new Promise((resolve) => {
        synthesizer.speakTextAsync(text,
            function (result) {
                if (result.reason != sdk.ResultReason.SynthesizingAudioCompleted) {
                    console.error("Speech synthesis canceled, " + result.errorDetails +
                        "\nDid you set the speech resource key and region values?");
                    fileName = null;
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