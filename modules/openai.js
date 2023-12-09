import OpenAI from 'openai';
import { load } from './jsonHandler.js';

const secrets = load('secrets');
const openai = new OpenAI({ apiKey: secrets.apiKey });
export { openai };