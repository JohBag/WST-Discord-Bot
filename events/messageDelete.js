import { save, load } from '../modules/jsonHandler.js';
import log from '../modules/log.js';

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
            log('Deleted vote: ' + id);
        }
    },
};