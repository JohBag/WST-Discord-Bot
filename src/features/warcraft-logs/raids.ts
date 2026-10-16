import { config } from '../../core/config.js';
import { sendQuery } from './api.js';

export interface Fight {
	id: number;
	name: string;
	difficulty: number;
	kill: boolean;
	fightPercentage: number;
}

export interface Report {
	code: string;
	startTime: number;
	endTime: number;
	zone: { id: number; name: string } | null;
	owner: { id: number; name: string };
	guild: { id: number } | null;
	fights: Fight[];
}

// One raid, possibly logged in several reports (autologgers, personal and guild uploads)
export interface RaidNight {
	report: Report;
	codes: string[];
}

// Normal, Heroic and Mythic. LFR and Mythic+ are left out since they are not guild raids.
export const raidDifficulties = [3, 4, 5];

const reportFields = `
	code startTime endTime
	zone { id name }
	owner { id name }
	guild { id }
	fights(killType: Encounters) { id name difficulty kill fightPercentage }
`;

export function isRaid(report: Report): boolean {
	return report.zone !== null && report.fights.some(fight => raidDifficulties.includes(fight.difficulty));
}

function overlaps(a: Report, b: Report): boolean {
	return a.zone?.id === b.zone?.id && a.startTime < b.endTime && b.startTime < a.endTime;
}

// Prefer reports assigned to the guild, then the most complete one
function pickReport(reports: Report[]): Report {
	return [...reports].sort((a, b) =>
		Number(b.guild !== null) - Number(a.guild !== null)
		|| b.fights.length - a.fights.length
		|| a.startTime - b.startTime
	)[0];
}

// Groups reports of the same zone with overlapping times into one raid night, newest first
export function groupRaidNights(reports: Report[]): RaidNight[] {
	const unique = [...new Map(reports.filter(isRaid).map(report => [report.code, report])).values()];
	unique.sort((a, b) => a.startTime - b.startTime);

	const groups: Report[][] = [];
	for (const report of unique) {
		const group = groups.find(group => group.some(other => overlaps(report, other)));
		if (group) {
			group.push(report);
		} else {
			groups.push([report]);
		}
	}

	return groups
		.map(group => ({ report: pickReport(group), codes: group.map(report => report.code) }))
		.sort((a, b) => b.report.startTime - a.report.startTime);
}

async function fetchReports(filter: string, since: number): Promise<Report[]> {
	const data = await sendQuery(`{ reportData { reports(${filter}, startTime: ${since}, limit: 25) { data { ${reportFields} } } } }`);
	return data.data.reportData.reports.data;
}

// Guild reports plus personal reports from known uploaders who sometimes forget to pick the guild
export async function findRaidNights(since: number): Promise<RaidNight[]> {
	const { guildId, uploaderIds } = config.warcraftLogs;
	const queries = [
		fetchReports(`guildID: ${guildId}`, since),
		...uploaderIds.map(id => fetchReports(`userID: ${id}`, since)),
	];
	const reports = (await Promise.all(queries)).flat();
	return groupRaidNights(reports);
}

export async function fetchReport(code: string): Promise<Report | null> {
	const data = await sendQuery(`query($code: String!) { reportData { report(code: $code) { ${reportFields} } } }`, { code });
	return data.data.reportData.report;
}
