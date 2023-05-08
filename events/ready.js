import log from '../modules/logger.js';

export default {
    name: 'ready',
    once: true,
    execute() {
        log('Ready!');
    },
};