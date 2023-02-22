import log from '../common/logger.js';

export default {
    name: 'ready',
    once: true,
    execute() {
        log('Ready!');
    },
};