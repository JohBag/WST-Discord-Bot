import fs from 'fs';
import log from './log.js';

export function load(fileName) {
	try {
		let rawdata = fs.readFileSync(`json/${fileName}.json`);
		return JSON.parse(rawdata);
	} catch (err) {
		log('Failed to find file with name ' + fileName);
	}
}

export function save(fileName, data) {
	data = JSON.stringify(data);
	fs.writeFileSync(`json/${fileName}.json`, data);
}