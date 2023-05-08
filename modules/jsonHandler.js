import fs from "fs";

export function load(fileName) {
    try {
        let rawdata = fs.readFileSync('json/' + fileName + '.json');
        return JSON.parse(rawdata);
    } catch (err) {
        console.log("Failed to find file with name " + fileName);
        save(fileName, {});
        console.log("Created empty file");
        return {};
    }
}

export function save(fileName, data) {
    data = JSON.stringify(data);
    fs.writeFileSync('json/' + fileName + '.json', data);
}