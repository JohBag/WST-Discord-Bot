import OpenAI from 'openai';
import { load } from './jsonHandler.js';

const secrets = load('secrets');
const config = load('config');
const openai = new OpenAI({ apiKey: secrets.apiKey });
export { openai };