const messageCharLimit = 2000;

export default class Message {
	constructor() {
		this.text = '';
		this.files = [];
		this.embeds = [];
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

	send(channel) {
		let chunks = splitResponse(this.text);
		chunks = chunks.map(chunk => ({
			content: chunk,
		}));

		const lastChunk = chunks[chunks.length - 1];
		lastChunk.files = this.files;
		lastChunk.embeds = this.embeds;

		chunks.forEach(chunk => {
			channel.send(chunk).catch(error => {
				console.error('Failed to send message:', error);
			});
		});
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