import { EmbedBuilder } from 'discord.js';
import { secrets, config } from '../modules/data.js';
import { generateResponse } from '../modules/gemini.js';
import log from '../modules/log.js';
import Message from '../modules/message.js';

const difficultyNames = {
	'3': 'Normal',
	'4': 'Heroic',
	'5': 'Mythic'
}

const roles = {
	'dps': 'Damage',
	'healers': 'Healing',
	'tanks': 'Tanking'
}

export default async function createWarcraftLog(id, conversation) {
	try {
		let report = await getReport(id);
		if (!report) {
			log('No report found with ID: ' + id);
			return await getFailResponse(conversation);
		}

		let embed = await embedReport(report, id);
		return new Message().addEmbed(embed);
	} catch (error) {
		log(error);
		return await getFailResponse(conversation);
	}
};

async function getFailResponse(conversation) {
	const failResponse = await generateResponse(config.prompt + '\nYou attempted unsuccessfully to create a Warcraft log. Apologise to the user and attempt to help them troubleshoot the issue.', conversation);
	return new Message().addText(failResponse.text);
}

async function getAccessToken() {
	const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
		method: 'POST',
		headers: {
			'Authorization': 'Basic ' + btoa(secrets.keys.warcraftLogs)
		},
		body: new URLSearchParams({
			'grant_type': 'client_credentials'
		})
	});

	const data = await response.json();
	return data.access_token
}

async function sendQuery(query) {
	const accessToken = await getAccessToken();

	const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ query })
	});

	const data = await response.json();
	return data;
}

function getBestPulls(fights) {
	let logs = {};

	for (let fight of fights) {
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

function getBossSection(report) {
	const logs = getBestPulls(report.fights);
	const section = Object.entries(logs).reduce((acc, [difficulty, progress]) => {
		acc[difficulty] = Object.entries(progress)
			.map(([name, perc]) => perc > 0 ? `${name} (${perc}%)` : name)
			.join('\n');
		return acc;
	}, {});
	return section;
}

async function getParticipants(report) {
	const fights = report.fights.map(fight => fight.id);
	const query = `query {
        reportData {
            report(code: "${report.code}") {
                playerDetails(fightIDs: [${fights}])
            }
        }
    }`;
	const data = await sendQuery(query);
	return data.data.reportData.report.playerDetails.data.playerDetails;
}

async function embedReport(report) {
	const embeddedMessage = new EmbedBuilder()
		.setColor(0x0099FF)
		.setTitle(report.zone.name)
		.setURL(`https://www.warcraftlogs.com/reports/${report.code}/`)
		.setDescription(formatTime(report.startTime));

	const bosses = getBossSection(report);
	for (let difficulty in bosses) {
		embeddedMessage.addFields({ name: difficultyNames[difficulty], value: bosses[difficulty] });
	}

	const participants = await getParticipants(report);
	for (let role in roles) {
		const names = participants[role].map(player => player.name).sort().join('\n');
		embeddedMessage.addFields({ name: roles[role], value: names, inline: true });
	}

	return embeddedMessage;
}

async function getReport(id) {
	if (!id) {
		log('No ID provided. Fetching most recent log.')
		// Get ID of most recent guild log
		const data = await sendQuery('{ reportData { reports(guildID: 66538, limit: 1) { data { code } } } }');
		id = data.data.reportData.reports.data[0].code
	}

	log('Fetching report with ID: ' + id);
	const query = `query{ 
        reportData { 
            report(code: "${id}") { 
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
	const data = await sendQuery(query);
	const report = data.data.reportData.report;

	return report;
}

function formatTime(date) {
	date = new Date(date);
	return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date);
}