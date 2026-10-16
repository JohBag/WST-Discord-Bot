import { config } from '../../core/config.js';
import log from '../../core/log.js';
import getConversation from './conversation.js';
import shouldRespond from './should-respond.js';
import getChannelSettings from './channel-settings.js';
import { generateReply } from '../../ai/chat.js';
import { generateImage } from '../../ai/gemini.js';
import createWarcraftLog from '../warcraft-logs/warcraft-logs.js';
import { createVote } from '../votes/votes.js';
import Message from '../../core/message.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, SendableChannels } from 'discord.js';

export default async function respond(interaction: DiscordMessage | ChatInputCommandInteraction): Promise<void> {
	const channelSettings = getChannelSettings(interaction.channel!.id);

	if (!shouldRespond(interaction as DiscordMessage, channelSettings.reactChance)) {
		return;
	}

	const conversation = await getConversation(interaction as DiscordMessage, channelSettings.messageLimit);
	if (!conversation) {
		return;
	}

	const model = channelSettings.model ?? config.models.text;
	const response = await generateReply({ model, systemPrompt: config.prompt, conversation, tools: true });

	let message = new Message();
	let channel = interaction.channel as SendableChannels;

	// Check for function calls in the response
	if (response.toolCalls.length > 0) {
		const functionCall = response.toolCalls[0]; // Assuming one function call
		const args = functionCall.args;
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
					const logChannel = message.channel ?? channel;
					// Without the actual details, the model invents placeholders like "[Insert Log Link]"
					const report = message.embeds[0]?.data;
					const where = logChannel.id === channel.id ? 'right after your reply' : `in <#${logChannel.id}>`;
					const instruction = `\nYou just fetched the Warcraft Logs report "${report?.title}" from ${report?.description}, `
						+ `link: ${report?.url}. A summary of it will be posted ${where}. Give the user a short, positive response about it. `
						+ 'Only use the details given here; do not invent links or results.';
					const successResponse = await generateReply({ model, systemPrompt: config.prompt + instruction, conversation, tools: false });
					if (successResponse.text) {
						await new Message().addText(successResponse.text).send(channel);
					}

					channel = logChannel;
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
		if (!response.text) {
			throw new Error('No text in response');
		}
		message.addText(response.text);
	}
	await message.send(channel);
}
