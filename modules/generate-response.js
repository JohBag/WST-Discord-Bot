import { config } from './data.js';
import getConversation from './conversations.js';
import getResponseAllowed from './response-allowed.js';
import { generateResponse, generateImage } from './gemini.js';
import createWarcraftLog from './warcraft-log.js';
import { createVote } from './votes.js';
import Message from './message.js';

export default async function tryGenerateResponse(interaction) {
	const channelSettings = getChannelSettings(interaction.channel.id);

	if (!getResponseAllowed(interaction, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction, channelSettings.messageLimit);

	// Generate response
	let response = await generateResponse(config.prompt, conversation);
	if (!response) {
		throw new Error('No response');
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
				let log = await createWarcraftLog(args.id);
				if (log) {
					message.addEmbed(log);
					if (config.logChannelId) {
						channel = interaction.guild.channels.cache.get(config.logChannelId) || channel;
					}
				} else {
					let failResponse = await generateResponse(config.prompt + '\nYou attempted unsuccessfully to create a Warcraft log. Apologise to the user and attempt to help them troubleshoot the issue.', conversation);
					message.addText(failResponse.text);
				}
				break;
			case 'create_vote':
				return await createVote(interaction, args.title, args.options, args.anonymity);
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