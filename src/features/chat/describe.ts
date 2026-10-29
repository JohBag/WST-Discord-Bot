// Turns what a Discord message shows into what the model reads. The bot and the chat export both use
// it, so comparisons see what the bot sees.

export interface MessageParts {
	// The text, with mentions and custom emoji already written as names
	text: string;
	attachments: { contentType?: string | null; url: string; size: number }[];
	embeds: { type?: string; title?: string | null; description?: string | null; imageUrl?: string | null }[];
}

// What Claude accepts, up to 5 MB each
const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const maxImageBytes = 5 * 1024 * 1024;
const previewLength = 200;

// Pictures, files and link previews become short notes, since the model only gets the newest few pictures themselves
export function describeMessage(parts: MessageParts): string {
	const lines = parts.text.trim() ? [parts.text] : [];
	for (const attachment of parts.attachments) {
		const type = attachment.contentType ?? '';
		lines.push(type.startsWith('image/') ? '[picture]' : type.startsWith('video/') ? '[video]' : '[file]');
	}
	for (const embed of parts.embeds) {
		if (embed.type === 'gifv') {
			lines.push('[GIF]');
		} else if (embed.type === 'image') {
			lines.push('[picture]');
		} else if (embed.title || embed.description) {
			lines.push(`[link preview: ${[embed.title, shorten(embed.description)].filter(Boolean).join(': ')}]`);
		}
	}
	return lines.join('\n');
}

// The pictures in a message the model can look at: attached images, then GIFs and link preview pictures
export function findImages(parts: MessageParts): string[] {
	return [
		...parts.attachments
			.filter(attachment => imageTypes.includes(attachment.contentType ?? '') && attachment.size <= maxImageBytes)
			.map(attachment => attachment.url),
		...parts.embeds.flatMap(embed => embed.imageUrl ? [embed.imageUrl] : []),
	];
}

// A quoted message, short enough to show what a reply refers to
export function quote(text: string, length = 100): string {
	const line = text.replace(/\s+/g, ' ').trim();
	return line.length > length ? `${line.slice(0, length - 3)}...` : line;
}

function shorten(text?: string | null): string | undefined {
	return text ? quote(text, previewLength) : undefined;
}
