import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { save, load } from '../modules/jsonHandler.js';
import log from '../modules/log.js';
import getUsername from '../modules/getUsername.js';

const maxOptions = 5; // Discord limit

export default {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Start a vote')
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Vote title')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('options')
                .setDescription(`Comma-separated list (max ${maxOptions} options)`)
                .setRequired(true))
        .addBooleanOption(option =>
            option
                .setName('anonymity')
                .setDescription('Name/score-based view (default: false)')),
    async execute(interaction) {
        try {
            if (interaction.isButton()) {
                try {
                    return await registerVote(interaction);
                } catch (error) {
                    log(error);
                    return interaction.reply({ content: "I'm sorry, I had trouble registering your vote.", ephemeral: true });
                }
            }

            // Get arguments/default values
            const title = interaction.options.getString('title');
            const optionString = interaction.options.getString('options');
            const anonymity = interaction.options.getBoolean('anonymity') || false;

            const vote = createVote(title, optionString, anonymity);
            if (!vote) {
                throw new Error('Failed to create vote');
            }

            await sendVote(interaction, vote);
        } catch (error) {
            log(error);
        }
    },
};

function splitOptions(optionString, anonymity) {
    return optionString
        .split(',')
        .map(i => i.trim())
        //.filter(i => i)
        .slice(0, maxOptions)
        .reduce((options, i) => {
            options[i] = anonymity ? 0 : {};
            return options;
        }, {});
}

function createVote(title, optionString, anonymity) {
    return {
        title: title,
        options: splitOptions(optionString, anonymity),
        voters: [],
        anonymity: anonymity,
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
    await interaction.reply({ embeds: [tally], components: [buttons] });

    // Store vote locally
    const reply = await interaction.fetchReply();
    const id = reply.id;

    let votes = load('votes');
    votes[id] = vote;
    save('votes', votes);
}

async function registerVote(interaction) {
    let votes = await load('votes');

    // Check if vote exists
    const id = interaction.message.id;
    let vote = votes[id];
    if (!vote) {
        return interaction.reply({ content: 'Failed to register vote', ephemeral: true });
    }

    // Add vote
    const voteID = interaction.customId;
    const userID = interaction.user.id;
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
            const name = await getUsername(interaction); // Get nickname or discord name
            vote.options[voteID][userID] = name;
        }
    }

    save('votes', votes);
    log(`[${vote.title}]: Vote registered for '${voteID}'`);

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
                result += `${data[ii]}\n`;
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