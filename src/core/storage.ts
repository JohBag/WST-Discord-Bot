import fs from 'fs';

// Reads config/<name>.json. A missing file reads as empty. A file that is there but can't be
// parsed throws, so nothing saves over it and loses what it held
export function load<T = Record<string, unknown>>(fileName: string): T {
	const path = `config/${fileName}.json`;
	let rawdata: string;
	try {
		rawdata = fs.readFileSync(path, 'utf-8');
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return {} as T;
		}
		throw err;
	}
	try {
		return JSON.parse(rawdata) as T;
	} catch (err) {
		throw new Error(`${path} is not valid JSON: ${(err as Error).message}`);
	}
}

export function exists(fileName: string): boolean {
	return fs.existsSync(`config/${fileName}.json`);
}

// Writes to a temporary file first and renames it over the old one, so a crash mid-write leaves the
// old file whole instead of half a new one
export function save(fileName: string, data: unknown): void {
	const path = `config/${fileName}.json`;
	const json = JSON.stringify(data, null, '\t');
	fs.writeFileSync(`${path}.tmp`, json);
	fs.renameSync(`${path}.tmp`, path);
}
