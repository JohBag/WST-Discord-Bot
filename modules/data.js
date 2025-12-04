import { load } from './json.js';

const config = load('config');
const secrets = load('secrets');
const voice = load('voice');

export { config, secrets, voice };