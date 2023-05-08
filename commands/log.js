import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { load } from '../modules/jsonHandler.js';
import log from '../modules/logger.js';

const secrets = load('secrets');

export default {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Fetches the warcraft log')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The report ID')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        const id = interaction.options.getString('id');
        let report = await getReport(id);
        if (!report) {
            // Weird solution to produce an ephemeral error message (edit doesn't work)
            await interaction.editReply({ content: 'Error', ephemeral: true });
            await interaction.followUp({ content: 'No report with id *' + id + '* could be found.', ephemeral: true });
            return interaction.deleteReply();
        }
        let log = await embedReport(report, id);

        return interaction.editReply({ embeds: [log] });
    },
};

async function getAccessToken() {
    const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(secrets.warcraftlogsToken)
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
        .setTitle(report.title)
        .setURL(`https://www.warcraftlogs.com/reports/${report.code}/`)
        .setDescription(formatTime(report.startTime));

    const bosses = getBossSection(report);
    if (bosses[3]) embeddedMessage.addFields({ name: "Normal", value: bosses[3] });
    if (bosses[4]) embeddedMessage.addFields({ name: "Heroic", value: bosses[4] });

    const participants = await getParticipants(report);
    const dps = participants["dps"].map(player => player.name).sort().join('\n');
    const healers = participants["healers"].map(player => player.name).sort().join('\n');
    const tanks = participants["tanks"].map(player => player.name).sort().join('\n');

    embeddedMessage.addFields({ name: "Damage", value: dps, inline: true });
    embeddedMessage.addFields({ name: "Healing", value: healers, inline: true });
    embeddedMessage.addFields({ name: "Tanking", value: tanks, inline: true });

    return embeddedMessage;
}

async function getReport(id) {
    if (!id) {
        log("No ID provided. Fetching most recent log.")
        // Get ID of most recent guild log
        const data = await sendQuery('{ reportData { reports(guildID: 66538, limit: 1) { data { code } } } }');
        id = data.data.reportData.reports.data[0].code
    }

    log("Fetching report with ID: " + id);
    const query = `query{ 
        reportData { 
            report(code: "${id}") { 
                code 
                title
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