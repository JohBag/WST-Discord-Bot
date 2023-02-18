import { save, load } from '../json_manager.js';

const secrets = load('secrets');
const config = load('config');

export default {
    name: 'messageDelete',
    async execute(interaction) {
        // Check if the message is a vote
        const id = interaction.id;
        let votes = load('votes');
        if (id in votes) {
            // Delete the vote
            delete votes[id];
            save('votes', votes);
            console.log("Deleted vote: " + id);
        }
    },
};