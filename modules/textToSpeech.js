import { secrets, voice } from '../modules/data.js';
import sdk from 'microsoft-cognitiveservices-speech-sdk';

export default async function textToSpeech(text) {
    var fileName = './media/SyntheticSpeech.mp3';

    const speechConfig = sdk.SpeechConfig.fromSubscription(secrets.speechKey, secrets.speechRegion);
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(fileName);

    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;

    // Create the speech synthesizer.
    var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const ssml =
        `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="${voice.lang}">
            <voice name="${voice.name}">
                <prosody rate="${voice.rate}" volume="${voice.volume}" pitch="${voice.pitch}">
                    ${text}
                </prosody>
            </voice>
        </speak>`;

    // Start the synthesizer and wait for a result.
    await new Promise((resolve) => {
        synthesizer.speakSsmlAsync(ssml,
            result => {
                if (result.errorDetails) {
                    console.error(result.errorDetails);
                    fileName = null;
                }
                synthesizer.close();
                synthesizer = null;
                resolve();
            },
            function (err) {
                console.trace('err - ' + err);
                synthesizer.close();
                synthesizer = null;
                resolve();
            });
    });

    return fileName;
}