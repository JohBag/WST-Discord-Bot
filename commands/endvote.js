import { SlashCommandBuilder } from 'discord.js';
import { save, load } from '../json_manager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('endvote')
        .setDescription('Stop the vote for the specified issue')
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('The name of the issue (or "all" to end all votes)')
                .setRequired(true)),
    async execute(interaction) {
        let votes = load('votes');

        let title = interaction.options.getString('title');
        if (title == 'all') {
            votes = {};
        } else {
            if (!votes.hasOwnProperty(title)) {
                return interaction.reply({ content: 'No vote with name *' + title + '* could be found', ephemeral: true });
            }
            delete votes[title];
        }

        save('votes', votes);

        return interaction.reply({ content: 'Vote ended successfully', ephemeral: true });
    },
};