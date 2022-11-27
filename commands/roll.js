import { SlashCommandBuilder } from 'discord.js';
import roll from '../random.js';

export default {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rolls a random value')
        .addIntegerOption(option =>
            option.setName('max')
                .setDescription('The highest possible value')),
    async execute(interaction) {
        const max = interaction.options.getInteger('max') ?? 100; // Default to 100
        const result = roll(1, max);

        const userName = interaction.member.displayName;
        return interaction.reply(userName + " rolls " + result);
    },
};