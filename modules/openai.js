import OpenAI from 'openai';
import { secrets } from './data.js';

const openai = new OpenAI({ apiKey: secrets.apiKey });

export { openai };