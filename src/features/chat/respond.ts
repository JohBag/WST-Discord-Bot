import { config } from '../../core/config.js';
import log from '../../core/log.js';
import getConversation, { rememberReply } from './conversation.js';
import shouldRespond from './should-respond.js';
import getChannelSettings from './channel-settings.js';
import { buildSystemPrompt } from './situation.js';
import type { ReplyReason } from './situation.js';
import { ReplyQueue } from './reply-queue.js';
import { isAnyoneTyping } from './typing.js';
import { generateReply } from '../../ai/chat.js';
import { generateImage } from '../../ai/gemini.js';
import { createVote } from '../votes/votes.js';
import Message from '../../core/message.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, SendableChannels } from 'discord.js';

type Trigger = DiscordMessage | ChatInputCommandInteraction;

// Discord shows "is typing" for about 10 seconds per request
const typingRefreshMs = 8000;

const queue = new ReplyQueue<Trigger>(reply, isAnyoneTyping);

export default async function respond(trigger: Trigger): Promise<void> {
	const settings = getChannelSettings(trigger.channelId!);
	const reason = shouldRespond(trigger, settings.reactChance);
	if (!reason) {
		return;
	}
	// Someone asked, so a reply is coming either way; dropping in uninvited shows typing once it starts
	if (reason === 'direct') {
		(trigger.channel as SendableChannels).sendTyping().catch(() => {});
	}
	await queue.add(trigger.channelId!, trigger, reason);
}

// Writes one reply and returns when the newest message it saw was sent
async function reply(trigger: Trigger, reason: ReplyReason): Promise<number> {
	const channel = trigger.channel as SendableChannels;
	const stopTyping = showTyping(channel);
	try {
		const { messages: conversation, seenUntil } = await getConversation(trigger as DiscordMessage);
		if (conversation.length === 0) {
			return seenUntil;
		}

		const model = config.models.text;
		const webSearch = config.chat.webSearch;
		const systemPrompt = buildSystemPrompt(config.prompt, reason, webSearch);
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
		const sent = await message.send(channel);
		rememberReply(sent.map(m => m.id), seenUntil);
		return seenUntil;
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
