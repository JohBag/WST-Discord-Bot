import log from '../../core/log.js';
import type { ChatImage } from '../../ai/conversation.js';

const mediaTypes: ChatImage['mediaType'][] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const maxBytes = 5 * 1024 * 1024;

// The same pictures stay in the conversation for several replies, so recent downloads are kept
const downloads = new Map<string, Promise<ChatImage | null>>();
const rememberedDownloads = 30;

// Downloads a picture for the model, or gives null when it can't be used
export function downloadImage(url: string): Promise<ChatImage | null> {
	// Discord signs its links, and the signature can change between fetches of the same message
	const key = url.split('?')[0];
	if (!downloads.has(key)) {
		downloads.set(key, fetchImage(url).then(image => {
			// Try again next time
			if (!image) {
				downloads.delete(key);
			}
			return image;
		}));
		// Maps keep insertion order, so the oldest go first
		for (const old of downloads.keys()) {
			if (downloads.size <= rememberedDownloads) {
				break;
			}
			downloads.delete(old);
		}
	}
	return downloads.get(key)!;
}

async function fetchImage(url: string): Promise<ChatImage | null> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
		const mediaType = response.headers.get('content-type')?.split(';')[0].trim() as ChatImage['mediaType'];
		if (!response.ok || !mediaTypes.includes(mediaType)) {
			log.warn(`Skipped a picture (${response.status} ${mediaType})`);
			return null;
		}
		const data = Buffer.from(await response.arrayBuffer());
		if (data.length > maxBytes) {
			log.warn(`Skipped a picture of ${Math.round(data.length / 1024)} KB`);
			return null;
		}
		return { mediaType, data: data.toString('base64') };
	} catch (error) {
		log.warn(`Couldn't download a picture: ${error}`);
		return null;
	}
}
