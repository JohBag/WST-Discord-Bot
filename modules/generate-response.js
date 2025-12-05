import { config } from './data.js';
import getConversation from './conversations.js';
import getResponseAllowed from './response-allowed.js';
import { generateResponse, generateImage } from './gemini.js';
import createWarcraftLog from './warcraft-log.js';
import { createVote } from './votes.js';
import Message from './message.js';
import log from './log.js';

export default async function tryGenerateResponse(interaction) {
	const channelSettings = getChannelSettings(interaction.channel.id);

	if (!getResponseAllowed(interaction, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction, channelSettings.messageLimit);

	// Generate response
	let response = await generateResponse(config.prompt, conversation);
	if (!response) {
		log('No response');
		return;
	}

	let message = new Message();
	let channel = interaction.channel;

	// Check for function calls in the response
	if (response.functionCalls && response.functionCalls.length > 0) {
		const functionCall = response.functionCalls[0]; // Assuming one function call
		const args = functionCall.args;
		switch (functionCall.name) {
			case 'generate_picture':
				message = await generateImage(args.prompt);
				break;
			case 'create_warcraft_log':
				message = await createWarcraftLog(args.id);
				if (message.success) {
					let successResponse = await generateResponse(config.prompt + '\nThe Warcraft Logs report was generated successfully! Give the user a positive response.', conversation, false);
					let successMessage = new Message();
					successMessage.addText(successResponse.text);
					successMessage.send(interaction.channel);

					channel = message.channel;
				}
				break;
			case 'create_vote':
				message = await createVote(interaction, args.title, args.options, args.anonymity);
				break;
			default:
				console.log(`Unknown function: ${functionCall.name}`);
				break;
		}
	} else {
		message.addText(response.text);
	}
	message.send(channel);
}

function getChannelSettings(channelID) {
	const { default: defaultSettings, [channelID]: channelSettings = {} } = config.channelSettings;
	return { ...defaultSettings, ...channelSettings };
}