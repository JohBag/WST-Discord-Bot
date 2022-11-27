import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import fs from 'fs';

const maxOptions = 5;

export default {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Start a vote')
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('The issue to vote about')
                .setRequired(true))
        .addBooleanOption(option =>
            option
                .setName('anonymity')
                .setDescription('True: Show only score. False: Show who voted for each option')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('options')
                .setDescription('Write all options here with comma-separation (max ' + maxOptions + ')')
                .setRequired(true)),
    async execute(interaction) {
        let votes = loadVotes();

        if (interaction.isButton()) {
            return registerVote(interaction, votes);
        }

        let args = interaction.options._hoistedOptions;
        let title = args[0].value
        let anonymity = args[1].value;
        let optionString = args[2].value;

        // Check uniqueness
        if (title in votes) {
            return interaction.reply({ content: 'A vote on this issue already exists. Use /endvote to end the previous vote', ephemeral: true });
        }

        // Get options
        optionString = optionString.replace(/\s+/g, ''); // Remove spaces
        let options = {};
        for (let i in optionString.split(',')) {
            if (i >= maxOptions) break;

            let name = optionString[i];
            if (name == '') continue;

            if (anonymity) {
                options[name] = 0;
            } else {
                options[name] = [];
            }
        }

        // Create vote
        let vote = {
            title: title,
            options: options,
            voters: [],
            anonymity: anonymity
        };
        votes[title] = vote;

        saveVotes(votes);

        // Create buttons
        var row = new ActionRowBuilder()
        for (let i in options) {
            row
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(i)
                        .setLabel(i)
                        .setStyle(ButtonStyle.Primary),
                );
        }

        let tally = getResult(vote);
        return interaction.reply({ content: title, embeds: [tally], components: [row] });
    },
};

function loadVotes() {
    let rawdata = fs.readFileSync('votes.json');
    return JSON.parse(rawdata);
}

function saveVotes(votes) {
    let data = JSON.stringify(votes);
    fs.writeFileSync('votes.json', data);
}

function registerVote(interaction, votes) {
    let title = interaction.message.content;
    let vote = votes[title];

    let userID = interaction.user.id;
    if (vote.voters.includes(userID)) {
        return interaction.reply({ content: 'You have already voted on this issue', ephemeral: true });
    }
    vote.voters.push(userID);
    if (vote.anonymity) {
        vote.options[interaction.customId] += 1;
    } else {
        vote.options[interaction.customId].push(interaction.member.nickname);
    }
    saveVotes(votes);
    console.log("Vote registered for " + interaction.customId);

    let tally = getResult(vote);
    interaction.update({ embeds: [tally] });
}

function getResult(vote) {
    let options = Object.keys(vote.options);

    let fields = [];
    for (let i of options) {
        let result = '-';

        let data = vote.options[i];
        if (vote.anonymity) {
            result = data;
        } else {
            if (data.length > 0) {
                result = '';
            }
            for (let ii of data) {
                result += ii + '\n';
            }
        }

        fields.push({ name: i, value: String(result), inline: true });
    }

    const embeddedMessage = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle("Result")
        .addFields(fields)

    return embeddedMessage;
}