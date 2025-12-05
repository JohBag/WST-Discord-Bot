import fs from 'fs';
import { load } from './json.js';

const config = load('config');
config.prompt = fs.readFileSync('config/prompt.txt', 'utf8');
const secrets = load('secrets');
const voice = load('voice');

export { config, secrets, voice };