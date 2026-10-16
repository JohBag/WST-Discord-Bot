import fs from 'fs';
import { config } from '../../core/config.js';
import type { ChannelSettings } from '../../types.js';

export default function getChannelSettings(channelID: string): ChannelSettings {
	const { default: defaultSettings, [channelID]: channelSettings = {} } = config.channelSettings;
	return { ...defaultSettings, ...channelSettings } as ChannelSettings;
}

const prompts = new Map<string, string>();

// The channel's prompt file, or config/prompt.txt. Read once, like the config.
export function getPrompt(settings: ChannelSettings): string {
	if (!settings.prompt) {
		return config.prompt;
	}
	if (!prompts.has(settings.prompt)) {
		prompts.set(settings.prompt, fs.readFileSync(settings.prompt, 'utf8'));
	}
	return prompts.get(settings.prompt)!;
}
