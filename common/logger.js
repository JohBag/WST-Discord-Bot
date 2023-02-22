import fs from 'fs';

export default async function log(text) {
    console.log(text);
    fs.appendFile('log.txt', text + '\n', (err) => {
        if (err) throw err;
    });
}