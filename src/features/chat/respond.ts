import { config } from '../../core/config.js';
import log from '../../core/log.js';
import getConversation from './conversation.js';
import shouldRespond from './should-respond.js';
import { generateResponse, generateImage } from '../../ai/gemini.js';
import createWarcraftLog from '../warcraft-logs/warcraft-logs.js';
import { createVote } from '../votes/votes.js';
import Message from '../../core/message.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, SendableChannels } from 'discord.js';
import type { ChannelSettings } from '../../types.js';

export default async function respond(interaction: DiscordMessage | ChatInputCommandInteraction): Promise<void> {
	const channelSettings = getChannelSettings(interaction.channel!.id);

	if (!shouldRespond(interaction as DiscordMessage, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction as DiscordMessage, channelSettings.messageLimit);
	if (!conversation) {
		return;
	}

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
					if (successResponse.text) {
						await new Message().addText(successResponse.text).send(channel);
					}

					channel = message.channel ?? channel;
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
