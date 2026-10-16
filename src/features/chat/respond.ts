import { setTimeout as sleep } from 'timers/promises';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import getConversation from './conversation.js';
import shouldRespond from './should-respond.js';
import getChannelSettings, { getPrompt } from './channel-settings.js';
import { buildSystemPrompt } from './situation.js';
import type { ReplyReason } from './situation.js';
import { ReplyQueue } from './reply-queue.js';
import { generateReply } from '../../ai/chat.js';
import { generateImage } from '../../ai/gemini.js';
import createWarcraftLog from '../warcraft-logs/warcraft-logs.js';
import { createVote } from '../votes/votes.js';
import Message from '../../core/message.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, SendableChannels } from 'discord.js';

type Trigger = DiscordMessage | ChatInputCommandInteraction;

// Lets a burst of pings ("botty", "BOTTY", "you there?") arrive before the history is read
const gatherMs = 1000;
// Discord shows "is typing" for about 10 seconds per request
const typingRefreshMs = 8000;

const queue = new ReplyQueue<Trigger>(reply);

export default async function respond(trigger: Trigger): Promise<void> {
	const settings = getChannelSettings(trigger.channelId!);
	const reason = shouldRespond(trigger, settings.reactChance);
	if (reason) {
		await queue.add(trigger.channelId!, trigger, reason);
	}
}

// Writes one reply and returns when the history it is based on was read
async function reply(trigger: Trigger, reason: ReplyReason): Promise<number> {
	await sleep(gatherMs);
	const settings = getChannelSettings(trigger.channelId!);

	let channel = trigger.channel as SendableChannels;
	const stopTyping = showTyping(channel);
	try {
		const historyReadAt = Date.now();
		const conversation = await getConversation(trigger as DiscordMessage, settings.messageLimit);
		if (!conversation) {
			return historyReadAt;
		}

		const model = settings.model ?? config.models.text;
		const webSearch = settings.webSearch ?? false;
		const systemPrompt = buildSystemPrompt(getPrompt(settings), reason, webSearch);
		const response = await generateReply({ model, systemPrompt, conversation, tools: true, webSearch });
		if (response.usage.searches > 0) {
			log(`Searched the web ${response.usage.searches} time(s)`);
		}

		let message = new Message();

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
					message = await createWarcraftLog(trigger as DiscordMessage, args.id);
					if (message.success) {
						const logChannel = message.channel ?? channel;
						// Without the actual details, the model invents placeholders like "[Insert Log Link]"
						const report = message.embeds[0]?.data;
						const where = logChannel.id === channel.id ? 'right after your reply' : `in <#${logChannel.id}>`;
						const instruction = `\nYou just fetched the Warcraft Logs report "${report?.title}" from ${report?.description}, `
							+ `link: ${report?.url}. A summary of it will be posted ${where}. Give the user a short, positive response about it. `
							+ 'Only use the details given here; do not invent links or results.';
						const successResponse = await generateReply({ model, systemPrompt: systemPrompt + instruction, conversation, tools: false });
						if (successResponse.text) {
							await new Message().addText(successResponse.text).send(channel);
						}

						channel = logChannel;
					}
					break;
				case 'create_vote':
					if (!args.title || !args.options) throw new Error('create_vote requires title and options');
					message = await createVote(trigger as DiscordMessage, args.title, args.options, args.anonymity);
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
		return historyReadAt;
	} finally {
		stopTyping();
	}
}

// Shows "Botty is typing..." until stopped, so people can see a reply is coming
function showTyping(channel: SendableChannels): () => void {
	const send = () => channel.sendTyping().catch(() => {});
	send();
	const timer = setInterval(send, typingRefreshMs);
	return () => clearInterval(timer);
}
