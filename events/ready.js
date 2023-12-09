import log from '../modules/log.js';

export default {
    name: 'ready',
    once: true,
    execute() {
        log('Ready!');
    },
};