import { save, load } from '../json_manager.js';

const secrets = load('secrets');
const config = load('config');

export default {
    name: 'messageDelete',
    async execute(interaction) {
        const id = interaction.id;
        let votes = load('votes');
        if (id in votes) {
            delete votes[id];
            save('votes', votes);
            console.log("Deleted vote: " + id);
        }
    },
};