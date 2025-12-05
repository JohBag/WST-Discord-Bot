import fs from 'fs';
import { load } from './json.js';

const config = load('config');
config.prompt = fs.readFileSync('config/prompt.txt', 'utf8');
const secrets = load('secrets');

export { config, secrets };