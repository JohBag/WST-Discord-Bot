import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coin')
        .setDescription('Flip a coin'),
    async execute(interaction) {
        return interaction.reply(flipCoin());
    },
};

function random(min, max) {
    return Math.floor(Math.random() * ((max + 1) - min)) + min;
}

function roll(min = 1, max = 100) {
    return random(min, max);
}

function flipCoin() {
    return roll(0, 1) == 1 ? "Heads" : "Tails";
}