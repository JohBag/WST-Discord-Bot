import log from './log.js';
import type { TextBasedChannel, SendableChannels, EmbedBuilder, ActionRowBuilder, Message as DiscordMessage } from 'discord.js';

interface FileAttachment {
	attachment: string;
	name: string;
}

interface MessageChunk {
	content: string;
	files?: FileAttachment[];
	embeds?: EmbedBuilder[];
	components?: ActionRowBuilder[];
}

const messageCharLimit = 2000;

export default class Message {
	text: string = '';
	files: FileAttachment[] = [];
	embeds: EmbedBuilder[] = [];
	components: ActionRowBuilder[] = [];
	onSend: ((sentMessage: DiscordMessage, message: Message) => Promise<void>) | null = null;
	channel: SendableChannels | null = null;
	success: boolean = true;

	setText(text: string): this {
		this.text = text;
		return this;
	}

	addText(text: string): this {
		this.text += text;
		return this;
	}

	addFile(file: string): this {
		this.files.push({
			attachment: file,
			name: file.split('/').pop()!,
		});
		return this;
	}

	addEmbed(embed: EmbedBuilder): this {
		this.embeds.push(embed);
		return this;
	}

	addComponents(components: ActionRowBuilder[]): this {
		this.components = components;
		return this;
	}

	async send(channel?: SendableChannels): Promise<DiscordMessage> {
		if (channel) {
			this.channel = channel;
		}

		let chunks: MessageChunk[] = splitResponse(this.text).map(chunk => ({
			content: chunk,
		}));

		// Filter out chunks with only empty content (unless it's the only chunk with embeds/components)
		chunks = chunks.filter((chunk, idx) => {
			const hasContent = chunk.content.trim().length > 0;
			const isLastChunk = idx === chunks.length - 1;
			const hasEmbeds = this.embeds.length > 0;
			const hasComponents = this.components.length > 0;

			return hasContent || (isLastChunk && (hasEmbeds || hasComponents));
		});

		// If no chunks remain, create one with just embeds/components
		if (chunks.length === 0) {
			chunks = [{ content: '' }];
		}

		const lastChunk = chunks[chunks.length - 1];
		lastChunk.files = this.files;
		lastChunk.embeds = this.embeds;
		lastChunk.components = this.components;

		let sentMessage!: DiscordMessage;
		for (const chunk of chunks) {
			try {
				sentMessage = await this.channel!.send(chunk as any);
				log('Message sent, ID: ' + sentMessage.id);
			} catch (error) {
				log.error('Failed to send message: ' + error);
				throw error;
			}
		}

		if (this.onSend) {
			await this.onSend(sentMessage, this);
		}

		return sentMessage;
	}
}

export function splitResponse(response: string): string[] {
	const chunks: string[] = [];

	if (response.length <= messageCharLimit) {
		chunks.push(response);
		return chunks;
	}

	while (response.length) {
		const splitIndex = response.length <= messageCharLimit ? response.length : findSplitIndex(response);
		chunks.push(response.substring(0, splitIndex));
		response = response.substring(splitIndex).trim();
	}

	return chunks;
}

function findSplitIndex(response: string): number {
	const lastNewLine = response.lastIndexOf('\n', messageCharLimit);
	const lastCodeBlock = response.lastIndexOf('```', messageCharLimit);

	const splitIndex = Math.min(
		lastNewLine > -1 ? lastNewLine : messageCharLimit,
		lastCodeBlock > -1 ? lastCodeBlock : messageCharLimit
	);

	return splitIndex || messageCharLimit;
}
