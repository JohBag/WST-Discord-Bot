import fs from 'fs';
import log from './log.js';

export function load<T = Record<string, unknown>>(fileName: string): T {
	try {
		const rawdata = fs.readFileSync(`config/${fileName}.json`, 'utf-8');
		return JSON.parse(rawdata) as T;
	} catch (err) {
		log('Failed to find file with name ' + fileName);
		return {} as T;
	}
}

export function save(fileName: string, data: unknown): void {
	const json = JSON.stringify(data, null, '\t');
	fs.writeFileSync(`config/${fileName}.json`, json);
}
