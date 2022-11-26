import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config.json' assert { type: "json"};

export default {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Fetches the warcraft log')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The report ID')),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        const id = interaction.options.getString('id') ?? 0; // Default to 0 (most recent guild log)
        let report = await getReport(id);
        if (report == null) {
            // Weird solution to produce an ephemeral error message (edit doesn't work)
            await interaction.editReply({ content: 'Error', ephemeral: true });
            await interaction.followUp({ content: 'Error: No report with id *' + id + '* could be found.', ephemeral: true });
            return interaction.deleteReply();
        }
        let log = embedReport(report, id);

        return interaction.editReply({ embeds: [log] });
    },
};

async function getAccessToken() {
    const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(config.warcraftlogsToken)
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

    for (let i in fights) {
        let fight = fights[i];

        if (fight.difficulty in logs === false) {
            logs[fight.difficulty] = {};
        }

        let bestPulls = logs[fight.difficulty];
        let name = fight.name;
        let perc = 0;

        if (!fight.kill) {
            perc = fight.fightPercentage;

            if (name in bestPulls) {
                let bestPerc = bestPulls[name];

                if (perc > bestPerc) {
                    perc = bestPerc;
                }
            }
        }

        bestPulls[name] = perc;
    }
    return logs;
}

function getBossSection(report) {
    let section = {};
    let logs = getBestPulls(report.fights);
    for (let difficulty in logs) {
        if (difficulty in section === false) {
            section[difficulty] = "";
        }

        let progress = logs[difficulty];
        for (let boss in progress) {
            let perc = progress[boss];
            let name = boss;

            if (perc > 0) {
                name += " (" + perc + "%)";
            }

            section[difficulty] += name + "\n";
        }
    }
    return section;
}

function getTopParse(rankings) {
    let topParse = '';

    for (let i in rankings) { // Fights
        let bestRank = 0;
        let fight = rankings[i];
        let roles = fight.roles;

        for (let ii in roles) { // Roles
            let role = roles[ii];
            let characters = role.characters;

            for (let iii in characters) { // Characters
                let character = characters[iii];
                let rank = character.rankPercent;

                if (rank > bestRank) {
                    bestRank = rank;
                    topParse = `${rank}% ${character.name} (${fight.encounter.name})`;
                }
            }
        }
    }

    return topParse;
}

function getParticipants(fights) {
    let participants = {};

    for (let i in fights) {
        let fight = fights[i];
        let roles = fight.roles;

        for (let role in roles) {
            let roleData = roles[role];

            if (role in participants === false) {
                participants[role] = [];
            }

            let characters = roleData.characters;
            for (let ii in characters) {
                let character = characters[ii];
                if (participants[role].includes(character.name) === false) {
                    participants[role].push(character.name);
                }
            }
        }
    }

    return participants;
}

function getParticipantSection(report) {
    let roles = {};

    let participants = getParticipants(report.rankings.data);
    for (let role in participants) {
        if (role in roles === false) {
            roles[role] = "";
        }

        let characters = participants[role];
        for (let i in characters) {
            roles[role] += characters[i] + '\n';
        }
    }

    return roles;
}

function embedReport(report) {
    let fields = [];

    // Boss names, percentage included if best pull was a wipe
    let bosses = getBossSection(report);
    let heroic = 4;
    if (heroic in bosses) {
        fields.push({ name: "Heroic", value: bosses[heroic] })
    }
    let normal = 3;
    if (normal in bosses) {
        fields.push({ name: "Normal", value: bosses[normal] })
    }

    // Best parse
    fields.push({ name: "Top parse", value: getTopParse(report.rankings.data) })

    // Participants
    let participants = getParticipantSection(report);
    var roles = Object.keys(participants);
    fields.push({ name: "Damage", value: participants[roles[2]], inline: true })
    fields.push({ name: "Healing", value: participants[roles[1]], inline: true })
    fields.push({ name: "Tanking", value: participants[roles[0]], inline: true })

    const embeddedMessage = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(report.zone.name)
        .setURL("https://www.warcraftlogs.com/reports/" + report.code + "/")
        .setDescription(formatTime(report.startTime))
        .addFields(fields)

    return embeddedMessage;
}

async function getReport(id = 0) {
    if (id == 0) {
        // Get ID of most recent guild log
        let data = await sendQuery('{ reportData { reports(guildID: 66538, limit: 1) { data { code } } } }');
        id = data.data.reportData.reports.data[0].code
        console.log("No ID provided. Most recent log: " + id);
    }

    console.log("Fetching report with ID: " + id);
    const query = `query{ reportData { report(code: "${id}") { code title zone {name} startTime fights(killType: Encounters) { name difficulty kill fightPercentage } rankings } } }`;
    const data = await sendQuery(query);
    const report = data.data.reportData.report;

    return report;
}

function formatTime(date) {
    date = new Date(date);
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date);
}