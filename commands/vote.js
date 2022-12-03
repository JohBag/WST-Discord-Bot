import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { save, load } from '../json_manager.js';

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
        let votes = load('votes');

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
        //optionString = optionString.replace(/\s+/g, ''); // Remove spaces
        let options = {};
        let n = 0;
        for (let i of optionString.split(',')) {
            i = i.replace(/^,/, ''); // Remove leading space

            if (i == '') continue;

            if (anonymity) {
                options[i] = 0;
            } else {
                options[i] = [];
            }

            n++;
            if (n >= maxOptions) break;
        }

        // Create vote
        let vote = {
            title: title,
            options: options,
            voters: [],
            anonymity: anonymity
        };
        votes[title] = vote;

        save('votes', votes);

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
        return interaction.reply({ embeds: [tally], components: [row] });
    },
};

function registerVote(interaction, votes) {
    let title = interaction.message.embeds[0].title;
    if (!votes.hasOwnProperty(title)) {
        return interaction.reply({ content: 'The vote has already ended', ephemeral: true });
    }

    let vote = votes[title];

    let userID = interaction.user.id;
    if (vote.voters.includes(userID)) {
        return interaction.reply({ content: 'You have already voted on this issue', ephemeral: true });
    }
    vote.voters.push(userID);
    if (vote.anonymity) {
        vote.options[interaction.customId] += 1;
    } else {
        let name = interaction.member.nickname ?? interaction.user.username; // Get nickname, or discord name
        vote.options[interaction.customId].push(name);
    }
    save('votes', votes);
    console.log(title + " | Vote registered for " + interaction.customId);

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
        .setTitle(vote.title)
        .addFields(fields)

    return embeddedMessage;
}