import { config } from './data.js';
import log from './log.js';
import getConversation from './conversations.js';
import getResponseAllowed from './response-allowed.js';
import { generateResponse, generateImage } from './gemini.js';
import createWarcraftLog from './warcraft-log.js';
import { createVote } from './votes.js';
import Message from './message.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, SendableChannels } from 'discord.js';
import type { ChannelSettings } from '../types.js';

export default async function tryGenerateResponse(interaction: DiscordMessage | ChatInputCommandInteraction): Promise<void> {
	const channelSettings = getChannelSettings(interaction.channel!.id);

	if (!getResponseAllowed(interaction as DiscordMessage, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction as DiscordMessage, channelSettings.messageLimit);

	// Generate response
	const response = await generateResponse(config.prompt, conversation);
	if (!response) {
		throw new Error('No response');
	}

	let message = new Message();
	let channel = interaction.channel as SendableChannels;

	// Check for function calls in the response
	if (response.functionCalls && response.functionCalls.length > 0) {
		const functionCall = response.functionCalls[0]; // Assuming one function call
		const args: Record<string, any> = functionCall.args ?? {};
		log("Calling function: " + functionCall.name);
		log("Args: " + JSON.stringify(args));

		switch (functionCall.name) {
			case 'generate_picture':
				if (!args.prompt) throw new Error('generate_picture requires a prompt');
				message = await generateImage(args.prompt);
				break;
			case 'create_warcraft_log':
				message = await createWarcraftLog(interaction as DiscordMessage, args.id);
				if (message.success) {
					const successResponse = await generateResponse(config.prompt + '\nThe Warcraft Logs report was generated successfully! Give the user a positive response.', conversation, false);
					const successMessage = new Message();
					successMessage.addText(successResponse.text!);
					await successMessage.send(interaction.channel as SendableChannels);

					channel = message.channel as SendableChannels;
				}
				break;
			case 'create_vote':
				if (!args.title || !args.options) throw new Error('create_vote requires title and options');
				message = await createVote(interaction as DiscordMessage, args.title, args.options, args.anonymity);
				break;
			default:
				log.warn(`Unknown function: ${functionCall.name}`);
				break;
		}
	} else {
		if (response.text === undefined) {
			throw new Error('No text in response');
		}
		message.addText(response.text);
	}
	await message.send(channel);
}

function getChannelSettings(channelID: string): ChannelSettings {
	const { default: defaultSettings, [channelID]: channelSettings = {} } = config.channelSettings;
	return { ...defaultSettings, ...channelSettings } as ChannelSettings;
}
