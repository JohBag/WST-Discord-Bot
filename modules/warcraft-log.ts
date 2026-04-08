import { EmbedBuilder } from 'discord.js';
import type { Message, SendableChannels } from 'discord.js';
import { secrets } from '../modules/data.js';
import log from '../modules/log.js';
import BotMessage from '../modules/message.js';
import { config } from '../modules/data.js';

interface Fight {
	id: number;
	name: string;
	difficulty: number;
	kill: boolean;
	fightPercentage: number;
}

interface Report {
	zone: { name: string };
	code: string;
	startTime: number;
	fights: Fight[];
}

interface PlayerDetails {
	dps: { name: string }[];
	healers: { name: string }[];
	tanks: { name: string }[];
}

const difficultyNames: Record<string, string> = {
	'3': 'Normal',
	'4': 'Heroic',
	'5': 'Mythic'
};

const roles: Record<string, string> = {
	'dps': 'Damage',
	'healers': 'Healing',
	'tanks': 'Tanking'
};

let logChannel: SendableChannels | null = null;
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export default async function createWarcraftLog(interaction: Message, id?: string): Promise<BotMessage> {
	const embed = await getLogEmbed(id);

	const message = new BotMessage();
	message.channel = await getLogChannel(interaction);
	if (embed) {
		message.addEmbed(embed);
	} else {
		message.addText('I was unable to fetch the report. Please try again later.');
		message.success = false;
	}

	return message;
}

async function getLogChannel(interaction: Message): Promise<SendableChannels | null> {
	if (!logChannel) {
		if (config.logChannelId) {
			logChannel = interaction.guild!.channels.cache.get(config.logChannelId) as SendableChannels;
		}
	}
	return logChannel;
}

async function getLogEmbed(id?: string): Promise<EmbedBuilder | null> {
	const report = await getReport(id);
	if (!report) {
		log('No report found with ID: ' + id);
		return null;
	}

	return await embedReport(report);
}

async function getAccessToken(): Promise<string> {
	if (cachedToken && Date.now() < tokenExpiry) {
		return cachedToken;
	}

	const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
		method: 'POST',
		headers: {
			'Authorization': 'Basic ' + btoa(secrets.keys.warcraftLogs!)
		},
		body: new URLSearchParams({
			'grant_type': 'client_credentials'
		})
	});

	const data = await response.json() as { access_token: string; expires_in: number };
	cachedToken = data.access_token;
	tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
	return cachedToken;
}

async function sendQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
	const accessToken = await getAccessToken();

	const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ query, variables })
	});

	const data = await response.json();
	return data;
}

function getBestPulls(fights: Fight[]): Record<string, Record<string, number>> {
	const logs: Record<string, Record<string, number>> = {};

	for (const fight of fights) {
		if (!logs[fight.difficulty]) {
			logs[fight.difficulty] = {};
		}

		if (fight.kill) {
			logs[fight.difficulty][fight.name] = 0;
			continue;
		}

		// Best percentage
		logs[fight.difficulty][fight.name] =
			Math.min(fight.fightPercentage, logs[fight.difficulty][fight.name] ?? 100);
	}
	return logs;
}

function getBossSection(report: Report): Record<string, string> {
	const logs = getBestPulls(report.fights);
	const section = Object.entries(logs).reduce((acc: Record<string, string>, [difficulty, progress]) => {
		acc[difficulty] = Object.entries(progress)
			.map(([name, perc]) => perc > 0 ? `${name} (${perc}%)` : name)
			.join('\n');
		return acc;
	}, {});
	return section;
}

async function getParticipants(report: Report): Promise<PlayerDetails> {
	const fights = report.fights.map(fight => fight.id);
	const query = `query($code: String!) {
        reportData {
            report(code: $code) {
                playerDetails(fightIDs: [${fights}])
            }
        }
    }`;
	const data = await sendQuery(query, { code: report.code });
	return data.data.reportData.report.playerDetails.data.playerDetails;
}

async function embedReport(report: Report): Promise<EmbedBuilder> {
	const embeddedMessage = new EmbedBuilder()
		.setColor(0x0099FF)
		.setTitle(report.zone.name)
		.setURL(`https://www.warcraftlogs.com/reports/${report.code}/`)
		.setDescription(formatTime(report.startTime));

	const bosses = getBossSection(report);
	for (const difficulty in bosses) {
		embeddedMessage.addFields({ name: difficultyNames[difficulty], value: bosses[difficulty] });
	}

	const participants = await getParticipants(report);
	for (const role in roles) {
		const names = (participants[role as keyof PlayerDetails] as { name: string }[]).map(player => player.name).sort().join('\n');
		embeddedMessage.addFields({ name: roles[role], value: names, inline: true });
	}

	return embeddedMessage;
}

async function getReport(id?: string): Promise<Report | null> {
	if (!id) {
		log('No ID provided. Fetching most recent log.');
		// Get ID of most recent guild log
		const data = await sendQuery(`{ reportData { reports(guildID: ${config.warcraftLogsGuildId}, limit: 1) { data { code } } } }`);
		id = data.data.reportData.reports.data[0].code;
	}

	log('Fetching report with ID: ' + id);
	const query = `query($code: String!) {
        reportData {
            report(code: $code) {
                zone {
                    name
                }
                code
                startTime
                fights(killType: Encounters) {
                    id
                    name
                    difficulty
                    kill
                    fightPercentage
                }
            }
        }
    }`;
	const data = await sendQuery(query, { code: id });
	const report = data.data.reportData.report;

	return report;
}

function formatTime(date: number): string {
	return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date(date));
}
