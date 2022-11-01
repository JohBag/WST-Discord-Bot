async function getAccessToken() {
	const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
		method: 'POST',
		headers: {
			'Authorization': 'Basic ' + btoa('97a1b9d9-7d4f-470d-b40d-4effbb8ebe48:7Avt7DaqTM0lQguawh5w4S99Ozsp4QYG4oVb5v3z')
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
	var logs = {};
	for (let i = 0; i < fights.length; ++i) {
		let fight = fights[i];

		// Name (key)
		let name = "";
		if (fight.difficulty == 4) {
			name += "[H] ";
		}
		name += fight.name;

		// Progress (value)
		let perc = 0;
		if (!fight.kill) { // Wipe progress
			perc = fight.fightPercentage;
			if (name in logs) {
				if (perc > logs[name]) {
					perc = logs[name];
				}
			}
		}
		logs[name] = perc;
	}
	return logs;
}

function getBossSection(report) {
	var msg = "";

	var pulls = getBestPulls(report.fights);

	// Get kill progress
	for (let i in pulls) {
		msg += i;
		let perc = pulls[i];
		if (perc > 0) {
			msg += " (" + perc + "%)"
		}
		msg += "\n";
	}
	return msg;
}

function getRankSection(rankings) {
	let msg = "";

	let bestPlayer = "";
	let bestRank = 0;
	let fightName = "";
	for (let i in rankings) {
		let fight = rankings[i];

		let characters = fight.roles.dps.characters;
		for (let ii in characters) {
			let character = characters[ii];
			let rank = character.rankPercent;
			if (rank > bestRank) {
				bestRank = rank;
				bestPlayer = character.name;
				fightName = fight.encounter.name;
			}
		}
	}
	if (bestPlayer != "") {
		msg += "Top parse: " + bestRank + "% " + bestPlayer + " (" + fightName + ")";
	}
	return msg;
}

exports.getLogMessage = async function (id = 0) {
	if (id == 0) {
		// Get ID
		let data = await sendQuery('{ reportData { reports(guildID: 66538, limit: 1) { data { code } } } }');
		id = data.data.reportData.reports.data[0].code
		console.log("Most recent log: " + id);
	}
	const query = 'query{ reportData { report(code: "' + id + '") { title zone { name } fights(killType: Encounters) { name difficulty kill fightPercentage } rankings } } }';
	const data = await sendQuery(query);
	const report = data.data.reportData.report;

	var msg = "";
	msg += report.zone.name + "\n\n";

	msg += getBossSection(report) + "\n";
	msg += getRankSection(report.rankings.data) + "\n";
	msg += "\n" + "https://www.warcraftlogs.com/reports/" + id + "/";

	console.log(msg);
	return msg;
}