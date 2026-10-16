import { config } from '../../core/config.js';
import type { ChannelSettings } from '../../types.js';

export default function getChannelSettings(channelID: string): ChannelSettings {
	const { default: defaultSettings, [channelID]: channelSettings = {} } = config.channelSettings;
	return { ...defaultSettings, ...channelSettings } as ChannelSettings;
}
