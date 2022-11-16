import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Start a vote'),
    async execute(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('primary')
                    .setLabel('Click me!')
                    .setStyle(ButtonStyle.Primary),
            );

        return interaction.reply({ components: [row] });
    },
};