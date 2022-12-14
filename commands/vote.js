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
                .setDescription('True: Show only score. False: Show who voted for each option. Anonymous votes can not be changed.')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('options')
                .setDescription('Write all options with comma-separation (max ' + maxOptions + ')')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('A short description (optional)')),
    async execute(interaction) {
        if (interaction.isButton()) {
            return registerVote(interaction);
        }

        const args = interaction.options._hoistedOptions;
        const title = args[0].value
        const anonymity = args[1].value;
        const optionString = args[2].value;
        let descr = "";
        if (args.length > 3) {
            descr = args[3].value
        }

        const vote = createVote(interaction, title, descr, anonymity, optionString);
        if (vote == null) {
            return interaction.reply({ content: 'A vote on this issue already exists. Use /endvote to end the previous vote', ephemeral: true });
        }

        // Create buttons
        let row = new ActionRowBuilder()
        for (let i in vote.options) {
            row
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(i)
                        .setLabel(i)
                        .setStyle(ButtonStyle.Primary),
                );
        }

        const tally = getResult(vote);
        return interaction.reply({ embeds: [tally], components: [row] });
    },
};

function createVote(interaction, title, descr, anonymity, optionString) {
    let votes = load('votes');

    // Check uniqueness
    if (title in votes) {
        return null;
    }

    // Get options
    let options = {};
    let n = 0;
    for (let i of optionString.split(',')) {
        i = i.replace(/^\s+|\s+$/gm, ''); // Remove leading space

        if (i == '') continue;

        if (anonymity) {
            options[i] = 0;
        } else {
            options[i] = {};
        }

        n++;
        if (n >= maxOptions) break;
    }

    // Create vote
    let vote = {
        title: title,
        description: descr,
        options: options,
        voters: [],
        anonymity: anonymity
    };

    votes[title] = vote;

    save('votes', votes);

    return vote;
}

function registerVote(interaction) {
    let votes = load('votes');

    // Check if vote exists
    const title = interaction.message.embeds[0].title;
    if (!votes.hasOwnProperty(title)) {
        return interaction.reply({ content: 'The vote has already ended', ephemeral: true });
    }

    // Check if user already has voted
    let vote = votes[title];
    const userID = interaction.user.id;
    if (vote.voters.includes(userID)) {
        // Prevent change if anonymous
        if (vote.anonymity) {
            return interaction.reply({ content: 'Anonymous votes can not be changed', ephemeral: true });
        }

        // Remove previous vote
        for (let i in vote.options) {
            let option = vote.options[i];
            if (userID in option) {
                delete option[userID];
                break;
            }
        }
    } else {
        vote.voters.push(userID);
    }

    // Add vote
    if (vote.anonymity) {
        vote.options[interaction.customId] += 1;
    } else {
        const name = interaction.member.nickname ?? interaction.user.username; // Get nickname or discord name
        vote.options[interaction.customId][userID] = name;
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
            for (let ii in data) {
                result += data[ii] + '\n';
            }
        }

        // Remove dash
        if (result.length > 1) {
            result = result.slice(1);
        }

        fields.push({ name: i, value: String(result), inline: true });
    }

    console.log(vote);
    const embeddedMessage = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(vote.title)
        .addFields(fields)

    if (vote.description.length > 0) {
        embeddedMessage.setDescription(vote.description)
    }

    return embeddedMessage;
}