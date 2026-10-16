import { EmbedBuilder } from 'discord.js';
import { sendQuery } from './api.js';
import type { Fight, Report } from './raids.js';

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

const roles: Record<keyof PlayerDetails, string> = {
	'dps': 'Damage',
	'healers': 'Healing',
	'tanks': 'Tanking'
};

// How long a report must go without new data before it counts as finished
export const liveWindowMs = 30 * 60 * 1000;

export function isLive(report: Report, now: number = Date.now()): boolean {
	return now - report.endTime < liveWindowMs;
}

// Best result per boss and difficulty: 0 for a kill, otherwise the lowest boss health reached
export function getBestPulls(fights: Fight[]): Record<string, Record<string, number>> {
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

export async function embedReport(report: Report): Promise<EmbedBuilder> {
	const embeddedMessage = new EmbedBuilder()
		.setColor(0x0099FF)
		.setTitle(report.zone?.name ?? 'Warcraft Logs report')
		.setURL(`https://www.warcraftlogs.com/reports/${report.code}/`)
		.setDescription(formatTime(report.startTime));

	const bosses = getBossSection(report);
	for (const difficulty in bosses) {
		embeddedMessage.addFields({ name: difficultyNames[difficulty] ?? `Difficulty ${difficulty}`, value: bosses[difficulty] });
	}

	const participants = await getParticipants(report);
	for (const role in roles) {
		const players = participants[role as keyof PlayerDetails] ?? [];
		// Discord rejects empty field values
		const names = players.map(player => player.name).sort().join('\n') || '-';
		embeddedMessage.addFields({ name: roles[role as keyof PlayerDetails], value: names, inline: true });
	}

	if (isLive(report)) {
		embeddedMessage.setFooter({ text: '🔴 Live: updates as the raid is logged' });
	}

	return embeddedMessage;
}

function formatTime(date: number): string {
	return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date(date));
}
