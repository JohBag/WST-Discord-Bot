import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

var votes = {};

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
            option.setName('anonymity')
                .setDescription('True: Show only score. False: Show names and what they voted for'))
        .addStringOption(option =>
            option.setName('options')
                .setDescription('Write all options here with comma-separation')),
    async execute(interaction) {
        if (interaction.isButton()) {
            return registerVote(interaction);
        }

        let args = interaction.options._hoistedOptions;
        console.log(args);

        // Get options
        let optionString = args[2].value;
        optionString = optionString.replace(/\s+/g, ''); // Remove spaces
        let options = {};
        for (i of optionString.split(',')) {
            if (i == "") continue;
            options[i] = 0;
        }

        // Create vote
        let vote = {
            title: args[0].value,
            options: options,
            voters: [],
            anonymity: args[1].value
        };
        votes[title] = vote;

        // Create buttons
        var row = new ActionRowBuilder()
        for (i of options) {
            row
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(i)
                        .setLabel(i)
                        .setStyle(ButtonStyle.Primary),
                );
        }

        let tally = getResult(title);
        console.log(tally);
        return interaction.reply({ embeds: [tally], components: [row] });
    },
};

function registerVote(interaction) {
    let title = interaction.embeds[0];
    let vote = votes[title];

    let userID = interaction.user.id;
    if (vote.voters.includes(userID)) {
        return interaction.reply({ content: 'Error: You have already voted on this issue', ephemeral: true });
    }
    vote.voters.push(userID);
    vote.options[interaction.customId] += 1;
    console.log("Voted for " + interaction.customId);

    let tally = getResult(0);
    interaction.update({ embeds: [tally] });
}

function getResult(id) {
    let vote = votes[id]; // temp

    let options = Object.keys(vote.options);

    let fields = [];
    for (let i of options) {
        fields.push({ name: i, value: String(vote.options[i]), inline: true });
    }

    const embeddedMessage = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle("Result")
        .addFields(fields)

    return embeddedMessage;
}