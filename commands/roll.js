import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rolls 1-100'),
    async execute(interaction) {
        return interaction.reply(rollMessage(interaction.member.displayName));
    },
};

function random(min, max) {
    return Math.floor(Math.random() * ((max + 1) - min)) + min;
}

function roll(min = 1, max = 100) {
    return random(min, max);
}

function rollMessage(userName) {
    return userName + " rolls " + roll();
}