const messageCharLimit = 2000;

export default class Message {
	constructor() {
		this.text = '';
		this.files = [];
		this.embeds = [];
		this.components = [];
		this.onSend = null;
		this.channel = null;
		this.success = true;
	}

	setText(text) {
		this.text = text;
		return this;
	}

	addText(text) {
		this.text += text;
		return this;
	}

	addFile(file) {
		this.files.push({
			attachment: file,
			name: file.split('/').pop(),
		});
		return this;
	}

	addEmbed(embed) {
		this.embeds.push(embed);
		return this;
	}

	addComponents(components) {
		this.components = components;
		return this;
	}

	async send(channel) {
		if (channel) {
			this.channel = channel;
		}

		let chunks = splitResponse(this.text);
		chunks = chunks.map(chunk => ({
			content: chunk,
		}));

		const lastChunk = chunks[chunks.length - 1];
		lastChunk.files = this.files;
		lastChunk.embeds = this.embeds;
		lastChunk.components = this.components;

		let sentMessage;
		for (const chunk of chunks) {
			try {
				sentMessage = await this.channel.send(chunk);
				console.log('Message sent, ID:', sentMessage.id);
			} catch (error) {
				console.error('Failed to send message:', error);
				throw error;
			}
		}

		if (this.onSend) {
			await this.onSend(sentMessage, this);
		}

		return sentMessage;
	}
}

function splitResponse(response) {
	const chunks = [];

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

function findSplitIndex(response) {
	const lastNewLine = response.lastIndexOf('\n', messageCharLimit);
	const lastCodeBlock = response.lastIndexOf('```', messageCharLimit);

	const splitIndex = Math.min(
		lastNewLine > -1 ? lastNewLine : messageCharLimit,
		lastCodeBlock > -1 ? lastCodeBlock : messageCharLimit
	);

	return splitIndex;
}