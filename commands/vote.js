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
        const descr = args.length > 3 ? args[3].value : null;

        const vote = createVote(title, descr, anonymity, optionString);
        if (!vote) {
            return interaction.reply({ content: 'Failed to create vote', ephemeral: true });
        }

        sendVote(interaction, vote);

        return;
    },
};

function splitOptions(optionString, anonymity) {
    return optionString
        .split(',')
        .map(i => i.trim())
        .filter(i => i)
        .slice(0, maxOptions)
        .reduce((options, i) => {
            options[i] = anonymity ? 0 : {};
            return options;
        }, {});
}

function createVote(title, descr, anonymity, optionString) {
    return {
        title: title,
        description: descr,
        options: splitOptions(optionString, anonymity),
        voters: [],
        anonymity: anonymity
    };
}

async function sendVote(interaction, vote) {
    // Create buttons
    let buttons = new ActionRowBuilder()
    for (let i in vote.options) {
        buttons
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(i)
                    .setLabel(i)
                    .setStyle(ButtonStyle.Primary),
            );
    }

    // Send reply
    const tally = getResult(vote);
    const reply = await interaction.reply({ embeds: [tally], components: [buttons] });

    // Store vote locally
    //const message = await interaction.fetchReply();
    let votes = load('votes');
    votes[reply.id] = vote;
    save('votes', votes);
}

function registerVote(interaction) {
    let votes = load('votes');

    // Check if vote exists
    const title = interaction.message.embeds[0].title;
    if (!votes.hasOwnProperty(title)) {
        return interaction.reply({ content: 'Failed to register vote', ephemeral: true });
    }

    let vote = votes[title];
    const userID = interaction.user.id;

    // Add vote
    const voteID = interaction.customId;
    if (vote.anonymity) {
        if (vote.voters.includes(userID)) {
            // Prevent change if anonymous
            return interaction.reply({ content: 'Anonymous votes can not be changed', ephemeral: true });
        }
        vote.voters.push(userID);
        vote.options[voteID] += 1;
    } else {
        // Remove previous vote
        let option = vote.options[voteID];
        if (userID in option) {
            delete option[userID];
        }
        else {
            // Allow multiple votes
            const name = interaction.member.nickname ?? interaction.user.username; // Get nickname or discord name
            vote.options[voteID][userID] = name;
        }
    }

    save('votes', votes);
    console.log(title + " | Vote registered for \"" + voteID + "\"");

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

    const embeddedMessage = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(vote.title)
        .addFields(fields)

    if (vote.description) {
        embeddedMessage.setDescription(vote.description)
    }

    return embeddedMessage;
}