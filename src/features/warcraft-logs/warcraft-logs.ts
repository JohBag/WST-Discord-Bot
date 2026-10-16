import type { Message, SendableChannels } from 'discord.js';
import log from '../../core/log.js';
import BotMessage from '../../core/message.js';
import { config } from '../../core/config.js';
import { embedReport } from './embed.js';
import { fetchReport, findRaidNights } from './raids.js';
import type { Report } from './raids.js';

// How far back to look when asked for the latest raid
const latestLookbackMs = 30 * 24 * 60 * 60 * 1000;

export default async function createWarcraftLog(interaction: Message, id?: string): Promise<BotMessage> {
	const report = await getReport(id);

	const message = new BotMessage();
	message.channel = getLogChannel(interaction);
	if (report) {
		message.addEmbed(await embedReport(report));
	} else {
		log('No report found with ID: ' + id);
		message.addText('I was unable to fetch the report. Please try again later.');
		message.success = false;
	}

	return message;
}

function getLogChannel(interaction: Message): SendableChannels | null {
	const channelId = config.warcraftLogs.channelId;
	return channelId ? (interaction.guild!.channels.cache.get(channelId) as SendableChannels ?? null) : null;
}

async function getReport(id?: string): Promise<Report | null> {
	if (id) {
		log('Fetching report with ID: ' + id);
		return fetchReport(id);
	}

	log('No ID provided. Fetching most recent raid.');
	const [latest] = await findRaidNights(Date.now() - latestLookbackMs);
	return latest?.report ?? null;
}
