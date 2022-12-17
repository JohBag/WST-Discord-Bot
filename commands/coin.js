import { SlashCommandBuilder } from 'discord.js';
import roll from '../common/random.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coin')
        .setDescription('Flip a coin'),
    async execute(interaction) {
        return interaction.reply(flipCoin());
    },
};

function flipCoin() {
    return roll(0, 1) == 1 ? "Heads" : "Tails";
}