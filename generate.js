import { Configuration, OpenAIApi } from "openai";

var conversation = "The following is a conversation with an AI companion called Emily. Emily is playful, inquisitive, clever, and very friendly. \
Human: Hello, who are you? \
AI: Hi! My name is Emily, I am an AI created by OpenAI.";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function (req, res) {
  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: generatePrompt(req.body.text),
    temperature: 0.6,
    max_tokens: 512
  });

  let response = completion.data.choices[0].text;
  conversation += response;
  response = response.split(":").pop(); // Remove the role identifier ("AI: ")
  getSpeech(response);
  res.status(200).json({ result: response });
}

function generatePrompt(input) {
  conversation += "Human: " + input;
  return conversation;
}

function getSpeech(text) {
  require('dotenv').config();
  const player = require('node-wav-player');
  var sdk = require("microsoft-cognitiveservices-speech-sdk");
  var readline = require("readline");

  var audioFile = "SyntheticSpeech.wav";
  // This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);

  // The language of the voice that speaks.
  speechConfig.speechSynthesisVoiceName = "en-US-SaraNeural";

  // Create the speech synthesizer.
  var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Start the synthesizer and wait for a result.
  synthesizer.speakTextAsync(text,
    function (result) {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        console.log("synthesis finished.");
        player.play({
          path: './SyntheticSpeech.wav',
        });
      } else {
        console.error("Speech synthesis canceled, " + result.errorDetails +
          "\nDid you set the speech resource key and region values?");
      }
      synthesizer.close();
      synthesizer = null;
    },
    function (err) {
      console.trace("err - " + err);
      synthesizer.close();
      synthesizer = null;
    });
  console.log("Now synthesizing to: " + audioFile);
}