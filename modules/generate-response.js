import { config } from './data.js';
import getConversation from './conversations.js';
import sendMessage from './send-message.js';
import getResponseAllowed from './response-allowed.js';
import { generateResponse } from './gemini.js';

export default async function tryGenerateResponse(interaction) {
	const channelSettings = getChannelSettings(interaction.channel.id);

	if (!getResponseAllowed(interaction, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction, channelSettings.messageLimit);

	// Generate response
	const systemPrompt = config.basePrompt + " " + channelSettings.prompt;
	let response = await generateResponse(systemPrompt, conversation);
	if (!response) {
		throw new Error('No response');
	}
	response = filterName(response);

	sendMessage(interaction, response, channelSettings.textToSpeech);
}

function filterName(message) {
	const colonIndex = message.indexOf(':');
	if (colonIndex != -1) {
		const nicknames = config.nicknames;
		nicknames.push(config.name.toLowerCase());
		nicknames.some(name => {
			if (message.toLowerCase().startsWith(name)) {
				message = message.substring(colonIndex + 1).trim();
				return true;
			}
		});
	}

	return message;
}

function getChannelSettings(channelID) {
	const { default: defaultSettings, [channelID]: channelSettings = {} } = config.prompts;
	return { ...defaultSettings, ...channelSettings };
}