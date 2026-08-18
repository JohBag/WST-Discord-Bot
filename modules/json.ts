import fs from 'fs';
import log from './log.js';

export function exists(fileName: string): boolean {
	return fs.existsSync(path(fileName));
}

/** Throws on a missing or malformed file - use for files the bot cannot start without. */
export function loadRequired<T = Record<string, unknown>>(fileName: string): T {
	const rawdata = fs.readFileSync(path(fileName), 'utf-8');
	return JSON.parse(rawdata) as T;
}

/** Returns null only when the file is absent. A malformed file still throws, so typos are not swallowed. */
export function loadOptional<T = Record<string, unknown>>(fileName: string): T | null {
	return exists(fileName) ? loadRequired<T>(fileName) : null;
}

export function load<T = Record<string, unknown>>(fileName: string): T {
	try {
		const rawdata = fs.readFileSync(path(fileName), 'utf-8');
		return JSON.parse(rawdata) as T;
	} catch (err) {
		log('Failed to find file with name ' + fileName);
		return {} as T;
	}
}

export function save(fileName: string, data: unknown): void {
	const json = JSON.stringify(data, null, '\t');
	fs.writeFileSync(path(fileName), json);
}

function path(fileName: string): string {
	return `config/${fileName}.json`;
}
