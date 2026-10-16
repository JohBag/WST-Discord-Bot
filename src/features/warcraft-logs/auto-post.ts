import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { Client, SendableChannels } from 'discord.js';
import log from '../../core/log.js';
import { config } from '../../core/config.js';
import { exists, load, save } from '../../core/storage.js';
import { embedReport, isLive } from './embed.js';
import { findRaidNights } from './raids.js';
import type { RaidNight, Report } from './raids.js';

// A raid posted to the log channel, kept so later polls edit it instead of posting again
export interface PostedRaid {
	codes: string[];
	zoneId: number | undefined;
	startTime: number;
	endTime: number;
	messageId: string | null;
	signature: string;
}

interface State {
	raids: PostedRaid[];
}

const stateFile = 'warcraft-logs-posts';
// Reports uploaded after the raid can show up a day or two later
const lookbackMs = 3 * 24 * 60 * 60 * 1000;
const keepMs = 14 * 24 * 60 * 60 * 1000;

let polling = false;

export function startAutoPost(client: Client): void {
	const { channelId, pollMinutes } = config.warcraftLogs;
	if (!channelId) {
		log.warn('Warcraft Logs auto-posting is enabled but no channel is set');
		return;
	}

	log(`Checking Warcraft Logs for new raids every ${pollMinutes} minutes`);
	const run = () => poll(client).catch(error => log.error(`Warcraft Logs auto-post failed: ${error}`));
	setTimeout(run, 10 * 1000);
	setInterval(run, pollMinutes * 60 * 1000);
}

// Changes whenever the post's content would change
export function getSignature(report: Report, now: number = Date.now()): string {
	return [report.code, report.endTime, report.fights.length, isLive(report, now)].join('|');
}

export function findPostedRaid(raids: PostedRaid[], night: RaidNight): PostedRaid | undefined {
	const { report } = night;
	return raids.find(raid =>
		raid.codes.some(code => night.codes.includes(code))
		|| (raid.zoneId === report.zone?.id && raid.startTime < report.endTime && report.startTime < raid.endTime)
	);
}

async function poll(client: Client): Promise<void> {
	if (polling) {
		return;
	}
	polling = true;

	try {
		const firstRun = !exists(stateFile);
		const state: State = firstRun ? { raids: [] } : load<State>(stateFile);
		const nights = (await findRaidNights(Date.now() - lookbackMs)).reverse();
		const channel = await client.channels.fetch(config.warcraftLogs.channelId) as SendableChannels;

		for (const night of nights) {
			const { report } = night;
			const signature = getSignature(report);
			const posted = findPostedRaid(state.raids, night);

			if (!posted) {
				// On the very first run, only raids still in progress are posted, so the channel
				// is not flooded with old raids
				const messageId = firstRun && !isLive(report)
					? null
					: (await channel.send({ embeds: [await embedReport(report)] })).id;
				state.raids.push({
					codes: night.codes,
					zoneId: report.zone?.id,
					startTime: report.startTime,
					endTime: report.endTime,
					messageId,
					signature,
				});
				if (messageId) {
					log(`Posted raid ${report.code}`);
				}
			} else {
				posted.codes = [...new Set([...posted.codes, ...night.codes])];
				posted.startTime = Math.min(posted.startTime, report.startTime);
				posted.endTime = Math.max(posted.endTime, report.endTime);

				if (posted.messageId && posted.signature !== signature) {
					await editPost(channel, posted, report);
					posted.signature = signature;
				}
			}

			// Save after every change so a failure later in the loop cannot cause a second post
			save(stateFile, state);
		}

		state.raids = state.raids.filter(raid => Date.now() - raid.endTime < keepMs);
		save(stateFile, state);
	} finally {
		polling = false;
	}
}

async function editPost(channel: SendableChannels, posted: PostedRaid, report: Report): Promise<void> {
	try {
		const message = await channel.messages.fetch(posted.messageId!);
		await message.edit({ embeds: [await embedReport(report)] });
		log(`Updated raid post for ${report.code}`);
	} catch (error) {
		if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage) {
			// Someone deleted the post; leave it deleted
			log(`Raid post for ${report.code} was deleted, no longer updating it`);
			posted.messageId = null;
			return;
		}
		throw error;
	}
}
